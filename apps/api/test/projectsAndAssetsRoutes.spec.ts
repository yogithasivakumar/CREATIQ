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

describe("Projects API", () => {
  it("requires authentication", async () => {
    const response = await request(createApp()).get("/api/projects");
    expect(response.status).toBe(401);
  });

  it("creates and then lists a project for the authenticated user's workspace", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ name: "Spring Launch" });

    expect(created.status).toBe(201);
    expect(created.body.project.name).toBe("Spring Launch");

    const listed = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(listed.status).toBe(200);
    expect(listed.body.projects).toHaveLength(1);
  });

  it("rejects an empty project name", async () => {
    const response = await request(createApp())
      .post("/api/projects")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ name: "" });

    expect(response.status).toBe(400);
  });

  it("isolates projects between two different users' workspaces", async () => {
    const app = createApp();

    await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ name: "User 1's project" });

    const otherUserList = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${OTHER_USER_TOKEN}`);

    expect(otherUserList.body.projects).toHaveLength(0);
  });

  it("returns 404 when renaming a project that belongs to another user's workspace", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ name: "Mine" });

    const response = await request(app)
      .patch(`/api/projects/${created.body.project.id}`)
      .set("Authorization", `Bearer ${OTHER_USER_TOKEN}`)
      .send({ name: "Hijacked" });

    expect(response.status).toBe(404);
  });

  it("deletes a project it owns", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ name: "Delete me" });

    const response = await request(app)
      .delete(`/api/projects/${created.body.project.id}`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(response.status).toBe(204);
  });

  // Regression test for the real incident: a DB-level insert failure
  // (in production, this was an unapplied migration — a column the
  // code wrote to didn't exist yet) must surface as a clear error
  // response, not be silently swallowed into an empty project list.
  it("surfaces a database insert failure as a clean error response, not a silent no-op", async () => {
    store.failNextInsert.set("projects", 'column "name" of relation "projects" does not exist');

    const response = await request(createApp())
      .post("/api/projects")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ name: "Should fail" });

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(response.body.error).toBeTruthy();
    expect(store.tables.projects).toHaveLength(0);
  });
});

describe("Assets API", () => {
  it("requires authentication", async () => {
    const response = await request(createApp()).get("/api/assets");
    expect(response.status).toBe(401);
  });

  it("saves a generated image and returns it in the list", async () => {
    const app = createApp();

    const saved = await request(app)
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64, prompt: "a red bicycle" });

    expect(saved.status).toBe(201);
    expect(saved.body.asset.prompt).toBe("a red bicycle");
    expect(saved.body.asset.url).toContain("http");

    const listed = await request(app)
      .get("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(listed.status).toBe(200);
    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.total).toBe(1);
  });

  it("rejects a corrupt image payload with 400, not 500", async () => {
    const response = await request(createApp())
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: Buffer.from("garbage").toString("base64") });

    expect(response.status).toBe(400);
  });

  it("never returns another user's assets", async () => {
    const app = createApp();

    await request(app)
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64 });

    const otherUserList = await request(app)
      .get("/api/assets")
      .set("Authorization", `Bearer ${OTHER_USER_TOKEN}`);

    expect(otherUserList.body.items).toHaveLength(0);
  });

  it("returns 404 when fetching another user's asset by id", async () => {
    const app = createApp();

    const saved = await request(app)
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64 });

    const response = await request(app)
      .get(`/api/assets/${saved.body.asset.id}`)
      .set("Authorization", `Bearer ${OTHER_USER_TOKEN}`);

    expect(response.status).toBe(404);
  });

  it("returns 404 when deleting another user's asset", async () => {
    const app = createApp();

    const saved = await request(app)
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64 });

    const response = await request(app)
      .delete(`/api/assets/${saved.body.asset.id}`)
      .set("Authorization", `Bearer ${OTHER_USER_TOKEN}`);

    expect(response.status).toBe(404);
  });

  it("deletes its own asset successfully", async () => {
    const app = createApp();

    const saved = await request(app)
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64 });

    const response = await request(app)
      .delete(`/api/assets/${saved.body.asset.id}`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(response.status).toBe(204);
  });

  it("rejects an invalid pagination query", async () => {
    const response = await request(createApp())
      .get("/api/assets?page=0")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(response.status).toBe(400);
  });

  // Regression test for the real incident: saving a generated image
  // failed with a bare 500 because the `assets` table was missing the
  // project_id/prompt columns a pending migration should have added.
  // This simulates the same failure mode (a DB insert rejecting the
  // write) without needing a real misconfigured database, and checks
  // that the failure is reported cleanly and that the storage upload
  // that already succeeded is rolled back rather than left orphaned.
  it("surfaces an asset database insert failure as a clean error and rolls back the uploaded file", async () => {
    store.failNextInsert.set("assets", 'column "project_id" of relation "assets" does not exist');

    const response = await request(createApp())
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64, prompt: "should roll back" });

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(response.body.error).toBeTruthy();
    // No secrets, tokens, or image bytes in the response.
    expect(response.body.error).not.toContain(VALID_TOKEN);
    expect(store.tables.assets).toHaveLength(0);
    expect(store.storageFiles.size).toBe(0);
  });

  it("surfaces a storage upload failure as a clean error without creating any database rows", async () => {
    store.failNextUpload = true;

    const response = await request(createApp())
      .post("/api/assets")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ image: VALID_JPEG_BASE64 });

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(store.tables.assets).toHaveLength(0);
    expect(store.tables.generation_jobs).toHaveLength(0);
  });
});
