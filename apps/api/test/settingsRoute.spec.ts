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

describe("GET /api/settings", () => {
  it("requires authentication", async () => {
    const response = await request(createApp()).get("/api/settings");
    expect(response.status).toBe(401);
  });

  it("returns default settings for a first-time user", async () => {
    const response = await request(createApp())
      .get("/api/settings")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.settings.defaultCaptionStyle).toBe("product_highlight");
  });
});

describe("PATCH /api/settings", () => {
  it("requires authentication", async () => {
    const response = await request(createApp())
      .patch("/api/settings")
      .send({ defaultTone: "luxurious" });

    expect(response.status).toBe(401);
  });

  it("updates and persists a setting", async () => {
    const app = createApp();

    const updated = await request(app)
      .patch("/api/settings")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ defaultTone: "luxurious", hashtagCount: 10 });

    expect(updated.status).toBe(200);
    expect(updated.body.settings.defaultTone).toBe("luxurious");
    expect(updated.body.settings.hashtagCount).toBe(10);

    const fetched = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(fetched.body.settings.defaultTone).toBe("luxurious");
  });

  it("rejects an invalid hashtagCount", async () => {
    const response = await request(createApp())
      .patch("/api/settings")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ hashtagCount: 999 });

    expect(response.status).toBe(400);
  });

  it("rejects an invalid defaultTone enum value", async () => {
    const response = await request(createApp())
      .patch("/api/settings")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ defaultTone: "not_a_real_tone" });

    expect(response.status).toBe(400);
  });

  it("keeps settings isolated between users", async () => {
    const app = createApp();

    await request(app)
      .patch("/api/settings")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ defaultTone: "playful" });

    const otherUserSettings = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${OTHER_USER_TOKEN}`);

    expect(otherUserSettings.body.settings.defaultTone).toBe("engaging_friendly");
  });
});
