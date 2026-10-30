import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabaseClient, FakeSupabaseStore } from "./fakeSupabase.js";

const store = new FakeSupabaseStore();

const VALID_TOKEN = "valid-test-token";
const OTHER_USER_TOKEN = "other-user-token";
const TOKEN_TO_USER_ID: Record<string, string> = {
  [VALID_TOKEN]: "user-1",
  [OTHER_USER_TOKEN]: "user-2",
};

function buildValidJpeg(width = 512, height = 512): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const sof0 = Buffer.from([
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
  ]);
  const padding = Buffer.alloc(600, 0x00);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, sof0, padding, eoi]);
}

const VALID_JPEG_BASE64 = buildValidJpeg().toString("base64");

vi.mock("../src/services/supabase.service.js", () => ({
  checkSupabaseConnection: vi.fn().mockResolvedValue({ ok: true, message: "ok" }),
  getSupabaseAdminClient: () => {
    const fake = createFakeSupabaseClient(store);
    return {
      ...fake,
      auth: {
        getUser: async (token: string) => {
          const userId = TOKEN_TO_USER_ID[token];
          if (userId) {
            return { data: { user: { id: userId, email: `${userId}@example.com` } }, error: null };
          }
          return { data: { user: null }, error: new Error("Invalid token") };
        },
      },
    };
  },
}));

const { createApp } = await import("../src/app.js");

beforeEach(() => {
  store.reset();
});

async function saveTestAsset(app: ReturnType<typeof createApp>, token: string) {
  const res = await request(app)
    .post("/api/assets")
    .set("Authorization", `Bearer ${token}`)
    .send({ image: VALID_JPEG_BASE64, prompt: "a red bicycle" });
  return res.body.asset;
}

describe("Instagram connection endpoints — not configured (no META_APP_ID/SECRET/REDIRECT_URI in test env)", () => {
  it("GET /api/instagram/connect requires authentication", async () => {
    const response = await request(createApp()).get("/api/instagram/connect");
    expect(response.status).toBe(401);
  });

  it("GET /api/instagram/connect returns a clear 503 not-configured error", async () => {
    const response = await request(createApp())
      .get("/api/instagram/connect")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/not configured/i);
  });

  it("GET /api/instagram/status requires authentication", async () => {
    const response = await request(createApp()).get("/api/instagram/status");
    expect(response.status).toBe(401);
  });

  it("GET /api/instagram/status returns not connected when nothing is configured", async () => {
    const response = await request(createApp())
      .get("/api/instagram/status")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.connected).toBe(false);
  });

  it("POST /api/instagram/publish returns a clear 503 not-configured error", async () => {
    const app = createApp();
    const asset = await saveTestAsset(app, VALID_TOKEN);

    const response = await request(app)
      .post("/api/instagram/publish")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ assetId: asset.id, caption: "Hello world" });

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/not configured/i);
  });

  it("POST /api/instagram/publish never leaks an access token in its error response", async () => {
    const app = createApp();
    const asset = await saveTestAsset(app, VALID_TOKEN);

    const response = await request(app)
      .post("/api/instagram/publish")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ assetId: asset.id, caption: "Hello world" });

    expect(JSON.stringify(response.body)).not.toMatch(/access_token|bearer/i);
  });

  it("POST /api/instagram/publish rejects an invalid request body", async () => {
    const response = await request(createApp())
      .post("/api/instagram/publish")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ caption: "" });

    expect(response.status).toBe(400);
  });
});

describe("POST /api/instagram/schedule — persistence and validation", () => {
  it("requires authentication", async () => {
    const response = await request(createApp())
      .post("/api/instagram/schedule")
      .send({ assetId: "00000000-0000-0000-0000-000000000000", caption: "x", scheduledFor: new Date().toISOString() });

    expect(response.status).toBe(401);
  });

  it("persists a scheduled post referencing an asset the caller owns", async () => {
    const app = createApp();
    const asset = await saveTestAsset(app, VALID_TOKEN);
    const scheduledFor = new Date(Date.now() + 86400000).toISOString();

    const response = await request(app)
      .post("/api/instagram/schedule")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ assetId: asset.id, caption: "Scheduled caption", hashtags: ["Brand"], scheduledFor });

    expect(response.status).toBe(201);
    expect(response.body.post.status).toBe("pending");
    expect(response.body.post.assetId).toBe(asset.id);
  });

  it("rejects scheduling a post for another user's asset (cross-workspace IDOR check)", async () => {
    const app = createApp();
    const otherUsersAsset = await saveTestAsset(app, OTHER_USER_TOKEN);

    const response = await request(app)
      .post("/api/instagram/schedule")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: otherUsersAsset.id,
        caption: "Hijack attempt",
        scheduledFor: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(response.status).toBe(404);
  });

  it("rejects an invalid (non-ISO) scheduledFor value", async () => {
    const app = createApp();
    const asset = await saveTestAsset(app, VALID_TOKEN);

    const response = await request(app)
      .post("/api/instagram/schedule")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ assetId: asset.id, caption: "x", scheduledFor: "not-a-date" });

    expect(response.status).toBe(400);
  });

  it("rejects an empty caption", async () => {
    const app = createApp();
    const asset = await saveTestAsset(app, VALID_TOKEN);

    const response = await request(app)
      .post("/api/instagram/schedule")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ assetId: asset.id, caption: "", scheduledFor: new Date().toISOString() });

    expect(response.status).toBe(400);
  });

  it("lists only the caller's own scheduled posts", async () => {
    const app = createApp();
    const asset = await saveTestAsset(app, VALID_TOKEN);
    await request(app)
      .post("/api/instagram/schedule")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: asset.id,
        caption: "Mine",
        scheduledFor: new Date(Date.now() + 86400000).toISOString(),
      });

    const otherUserList = await request(app)
      .get("/api/instagram/scheduled")
      .set("Authorization", `Bearer ${OTHER_USER_TOKEN}`);

    expect(otherUserList.body.posts).toHaveLength(0);
  });

  it("GET /api/instagram/scheduled requires authentication", async () => {
    const response = await request(createApp()).get("/api/instagram/scheduled");
    expect(response.status).toBe(401);
  });

  it("publishing a scheduled post returns a clear not-configured error (no real Meta credentials in test env)", async () => {
    const app = createApp();
    const asset = await saveTestAsset(app, VALID_TOKEN);
    const scheduled = await request(app)
      .post("/api/instagram/schedule")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: asset.id,
        caption: "Will fail cleanly",
        scheduledFor: new Date(Date.now() + 86400000).toISOString(),
      });

    const response = await request(app)
      .post(`/api/instagram/scheduled/${scheduled.body.post.id}/publish`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/not configured/i);
  });

  it("cancels a scheduled post it owns", async () => {
    const app = createApp();
    const asset = await saveTestAsset(app, VALID_TOKEN);
    const scheduled = await request(app)
      .post("/api/instagram/schedule")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: asset.id,
        caption: "Cancel me",
        scheduledFor: new Date(Date.now() + 86400000).toISOString(),
      });

    const response = await request(app)
      .delete(`/api/instagram/scheduled/${scheduled.body.post.id}`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(response.status).toBe(204);
  });

  it("returns 404 when cancelling another user's scheduled post", async () => {
    const app = createApp();
    const asset = await saveTestAsset(app, VALID_TOKEN);
    const scheduled = await request(app)
      .post("/api/instagram/schedule")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: asset.id,
        caption: "Not yours",
        scheduledFor: new Date(Date.now() + 86400000).toISOString(),
      });

    const response = await request(app)
      .delete(`/api/instagram/scheduled/${scheduled.body.post.id}`)
      .set("Authorization", `Bearer ${OTHER_USER_TOKEN}`);

    expect(response.status).toBe(404);
  });
});

describe("GET /api/instagram/callback — redirect target", () => {
  it("redirects errors to the frontend origin (CORS_ORIGIN), not a relative path", async () => {
    const response = await request(createApp())
      .get("/api/instagram/callback")
      .query({ error: "access_denied" });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "http://localhost:3000/dashboard/instagram?instagram=error&reason=access_denied"
    );
  });

  it("URL-encodes the error reason in the redirect", async () => {
    const response = await request(createApp())
      .get("/api/instagram/callback")
      .query({ error: "user denied: extra permissions" });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "http://localhost:3000/dashboard/instagram?instagram=error&reason=user%20denied%3A%20extra%20permissions"
    );
  });

  it("redirects to the frontend origin with a clear reason when code or state is missing", async () => {
    const response = await request(createApp()).get("/api/instagram/callback");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "http://localhost:3000/dashboard/instagram?instagram=error&reason=missing_code_or_state"
    );
  });

  it("never uses an untrusted request-supplied origin for the redirect", async () => {
    const response = await request(createApp())
      .get("/api/instagram/callback")
      .query({ error: "x", frontendOrigin: "https://evil.example.com" });

    expect(response.status).toBe(302);
    expect(response.headers.location!.startsWith("http://localhost:3000/")).toBe(true);
    expect(response.headers.location).not.toMatch(/evil\.example\.com/);
  });
});

describe("POST /api/instagram/disconnect", () => {
  it("requires authentication", async () => {
    const response = await request(createApp()).post("/api/instagram/disconnect");
    expect(response.status).toBe(401);
  });

  it("succeeds even when there was never a connection (idempotent)", async () => {
    const response = await request(createApp())
      .post("/api/instagram/disconnect")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(response.status).toBe(204);
  });
});
