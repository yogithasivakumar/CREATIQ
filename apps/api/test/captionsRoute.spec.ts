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

describe("POST /api/captions/generate", () => {
  it("requires authentication", async () => {
    const response = await request(createApp())
      .post("/api/captions/generate")
      .send({ assetId: "00000000-0000-0000-0000-000000000000", style: "product_highlight", tone: "engaging_friendly", length: "medium" });

    expect(response.status).toBe(401);
  });

  it("generates a caption and hashtags for an asset the caller owns", async () => {
    const app = createApp();
    const saved = await request(app)
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64, prompt: "a luxury perfume bottle" });

    const response = await request(app)
      .post("/api/captions/generate")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: saved.body.asset.id,
        style: "product_highlight",
        tone: "luxurious",
        length: "medium",
        hashtagCount: 5,
      });

    expect(response.status).toBe(200);
    expect(typeof response.body.caption).toBe("string");
    expect(response.body.caption.length).toBeGreaterThan(0);
    expect(Array.isArray(response.body.hashtags)).toBe(true);
    expect(response.body.hashtags).toHaveLength(5);
  });

  it("rejects generating a caption for another user's asset (cross-workspace IDOR check)", async () => {
    const app = createApp();
    const otherUsersAsset = await request(app)
      .post("/api/assets")
      .set("Authorization", `Bearer ${OTHER_USER_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64 });

    const response = await request(app)
      .post("/api/captions/generate")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: otherUsersAsset.body.asset.id,
        style: "product_highlight",
        tone: "engaging_friendly",
        length: "medium",
      });

    expect(response.status).toBe(404);
  });

  it("rejects an invalid style value", async () => {
    const app = createApp();
    const saved = await request(app)
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64 });

    const response = await request(app)
      .post("/api/captions/generate")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: saved.body.asset.id,
        style: "not_a_real_style",
        tone: "engaging_friendly",
        length: "medium",
      });

    expect(response.status).toBe(400);
  });

  it("rejects a nonexistent asset id with 404", async () => {
    const response = await request(createApp())
      .post("/api/captions/generate")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: "00000000-0000-0000-0000-000000000000",
        style: "product_highlight",
        tone: "engaging_friendly",
        length: "medium",
      });

    expect(response.status).toBe(404);
  });

  it("produces a different caption when variant changes (manual Regenerate)", async () => {
    const app = createApp();
    const saved = await request(app)
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64, prompt: "a mountain landscape" });

    const first = await request(app)
      .post("/api/captions/generate")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: saved.body.asset.id,
        style: "storytelling",
        tone: "engaging_friendly",
        length: "medium",
        variant: 0,
      });

    const second = await request(app)
      .post("/api/captions/generate")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({
        assetId: saved.body.asset.id,
        style: "storytelling",
        tone: "engaging_friendly",
        length: "medium",
        variant: 1,
      });

    expect(first.body.caption).not.toBe(second.body.caption);
  });
});
