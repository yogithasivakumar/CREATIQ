import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvForTests } from "../src/config/env.js";
import { createFakeSupabaseClient, FakeSupabaseStore } from "./fakeSupabase.js";

// Regression coverage for the confirmed-live bug (2026-10-30): both
// /media and /media_publish were being sent as GET requests (graphFetch
// had no concept of HTTP method), which Graph API interprets as
// reading a field named "media_publish" rather than invoking it as a
// write action — producing the exact error
// "(#100) Tried accessing nonexisting field (media_publish)". These
// tests assert both calls are sent as real POST requests.

const store = new FakeSupabaseStore();

const VALID_TOKEN = "valid-test-token";
const TOKEN_TO_USER_ID: Record<string, string> = { [VALID_TOKEN]: "user-1" };

const BASE_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_SECRET_KEY: "test-secret-key",
  CORS_ORIGIN: "http://localhost:3000",
  META_APP_ID: "test-app-id",
  META_APP_SECRET: "test-app-secret",
  META_REDIRECT_URI: "http://localhost:4000/api/instagram/callback",
  META_LOGIN_CONFIG_ID: "test-login-config-id",
};

function withEnv(overrides: Record<string, string | undefined>) {
  const original = { ...process.env };
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    process.env = original;
  };
}

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

let restoreEnv: () => void;
let fetchSpy: ReturnType<typeof vi.spyOn>;
let requestLog: { url: string; method: string }[] = [];

beforeEach(() => {
  store.reset();
  resetEnvForTests();
  restoreEnv = withEnv({});
  requestLog = [];
});

afterEach(() => {
  restoreEnv();
  resetEnvForTests();
  fetchSpy?.mockRestore();
});

const ALL_GRANTED_PERMISSIONS = {
  data: [
    { permission: "pages_show_list", status: "granted" },
    { permission: "business_management", status: "granted" },
    { permission: "instagram_basic", status: "granted" },
    { permission: "instagram_content_publish", status: "granted" },
    { permission: "pages_read_engagement", status: "granted" },
  ],
};

function mockGraphApiForConnectAndPublish() {
  fetchSpy = vi.spyOn(global, "fetch").mockImplementation(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      requestLog.push({ url, method });

      if (url.includes("/oauth/access_token")) {
        return new Response(
          JSON.stringify({ access_token: "mock-token", expires_in: 5184000 }),
          { status: 200 }
        );
      }
      if (url.includes("/me/permissions")) {
        return new Response(JSON.stringify(ALL_GRANTED_PERMISSIONS), { status: 200 });
      }
      if (url.includes("/me/accounts")) {
        return new Response(
          JSON.stringify({
            data: [{ id: "page-123", name: "Creatiq Page", access_token: "mock-page-token" }],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/page-123?")) {
        return new Response(
          JSON.stringify({ id: "page-123", instagram_business_account: { id: "ig-business-456" } }),
          { status: 200 }
        );
      }
      // fetchInstagramUsername
      if (url.includes("/ig-business-456?")) {
        return new Response(JSON.stringify({ id: "ig-business-456", username: "nehasuresh93" }), {
          status: 200,
        });
      }
      // POST /{ig-id}/media — create container
      if (url.includes("/ig-business-456/media?")) {
        return new Response(JSON.stringify({ id: "container-789" }), { status: 200 });
      }
      // POST /{ig-id}/media_publish
      if (url.includes("/ig-business-456/media_publish?")) {
        return new Response(JSON.stringify({ id: "published-media-001" }), { status: 200 });
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }
  );
}

async function connectInstagram(app: ReturnType<typeof createApp>): Promise<void> {
  const connectResponse = await request(app)
    .get("/api/instagram/connect")
    .set("Authorization", `Bearer ${VALID_TOKEN}`);
  const state = new URL(connectResponse.body.url).searchParams.get("state")!;

  const callbackResponse = await request(app)
    .get("/api/instagram/callback")
    .query({ code: "mock-auth-code", state });

  if (!callbackResponse.headers.location?.includes("instagram=connected")) {
    throw new Error(`Test setup failed to connect: ${callbackResponse.headers.location}`);
  }
}

async function saveTestAsset(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post("/api/assets")
    .set("Authorization", `Bearer ${VALID_TOKEN}`)
    .send({ image: VALID_JPEG_BASE64, prompt: "a red bicycle" });
  return res.body.asset.id;
}

describe("POST /api/instagram/publish — real Graph API call shape", () => {
  it("calls both /media and /media_publish with method POST, not GET", async () => {
    const app = createApp();
    mockGraphApiForConnectAndPublish();
    await connectInstagram(app);
    const assetId = await saveTestAsset(app);

    const response = await request(app)
      .post("/api/instagram/publish")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ assetId, caption: "Hello world" });

    expect(response.status).toBe(200);
    expect(response.body.instagramMediaId).toBe("published-media-001");

    const mediaCall = requestLog.find((r) => r.url.includes("/ig-business-456/media?"));
    const publishCall = requestLog.find((r) => r.url.includes("/ig-business-456/media_publish?"));

    expect(mediaCall).toBeDefined();
    expect(mediaCall!.method).toBe("POST");

    expect(publishCall).toBeDefined();
    expect(publishCall!.method).toBe("POST");
  });

  it("uses the Instagram Business Account ID (not the Facebook Page ID) in the media/media_publish URLs", async () => {
    const app = createApp();
    mockGraphApiForConnectAndPublish();
    await connectInstagram(app);
    const assetId = await saveTestAsset(app);

    await request(app)
      .post("/api/instagram/publish")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ assetId, caption: "Hello world" });

    const mediaCall = requestLog.find((r) => r.url.includes("/media?") && !r.url.includes("page-123"));
    expect(mediaCall).toBeDefined();
    expect(mediaCall!.url).toContain("/ig-business-456/media");
    expect(mediaCall!.url).not.toContain("/page-123/media");
  });

  it("never leaks the stored access token in the publish response", async () => {
    const app = createApp();
    mockGraphApiForConnectAndPublish();
    await connectInstagram(app);
    const assetId = await saveTestAsset(app);

    const response = await request(app)
      .post("/api/instagram/publish")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ assetId, caption: "Hello world" });

    expect(JSON.stringify(response.body)).not.toMatch(/mock-page-token|mock-token/);
  });
});
