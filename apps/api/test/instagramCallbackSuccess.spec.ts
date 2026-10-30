import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvForTests } from "../src/config/env.js";
import { createFakeSupabaseClient, FakeSupabaseStore } from "./fakeSupabase.js";

// Isolated from instagram.spec.ts because it needs META_* env vars set
// and loadEnv()/requireMetaConfig() memoize env at first call — mixing
// that with the "not configured" suite (which asserts the opposite)
// in one file/process would make load order matter.

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

beforeEach(() => {
  store.reset();
  resetEnvForTests();
  restoreEnv = withEnv({});
});

afterEach(() => {
  restoreEnv();
  resetEnvForTests();
  fetchSpy?.mockRestore();
});

// Mirrors the real, confirmed-live /me/permissions response (2026-10-30)
// after business_management was added to the Login Configuration.
const ALL_GRANTED_PERMISSIONS = {
  data: [
    { permission: "pages_show_list", status: "granted" },
    { permission: "business_management", status: "granted" },
    { permission: "instagram_basic", status: "granted" },
    { permission: "instagram_content_publish", status: "granted" },
    { permission: "pages_read_engagement", status: "granted" },
    { permission: "public_profile", status: "granted" },
  ],
};

function mockGraphApiSuccess(options?: {
  linkedVia?: "instagram_business_account" | "connected_instagram_account";
  permissions?: { data: { permission: string; status: string }[] };
}) {
  const linkedField = options?.linkedVia ?? "instagram_business_account";
  const permissions = options?.permissions ?? ALL_GRANTED_PERMISSIONS;

  fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/oauth/access_token")) {
      return new Response(
        JSON.stringify({ access_token: "mock-token", token_type: "bearer", expires_in: 5184000 }),
        { status: 200 }
      );
    }
    if (url.includes("/me/permissions")) {
      return new Response(JSON.stringify(permissions), { status: 200 });
    }
    // GET /me/accounts — Page IDs + Page access tokens only, no nested
    // Instagram field (matches Meta's documented two-step discovery).
    if (url.includes("/me/accounts")) {
      return new Response(
        JSON.stringify({
          data: [{ id: "page-123", name: "Creatiq Page", access_token: "mock-page-token" }],
        }),
        { status: 200 }
      );
    }
    // GET /{page-id}?fields=instagram_business_account,connected_instagram_account
    if (url.includes("/page-123?")) {
      return new Response(
        JSON.stringify({ id: "page-123", [linkedField]: { id: "ig-business-456" } }),
        { status: 200 }
      );
    }
    // fetchInstagramUsername
    return new Response(JSON.stringify({ id: "ig-business-456", username: "nehasuresh93" }), {
      status: 200,
    });
  });
}

async function mintState(app: ReturnType<typeof createApp>): Promise<string> {
  const connectResponse = await request(app)
    .get("/api/instagram/connect")
    .set("Authorization", `Bearer ${VALID_TOKEN}`);

  const url = new URL(connectResponse.body.url);
  const state = url.searchParams.get("state");
  if (!state) throw new Error("No state minted by /connect in test setup");
  return state;
}

describe("GET /api/instagram/callback — success redirect", () => {
  it("redirects to the frontend Instagram Publishing page on success", async () => {
    const app = createApp();
    const state = await mintState(app);
    mockGraphApiSuccess();

    const response = await request(app)
      .get("/api/instagram/callback")
      .query({ code: "mock-auth-code", state });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "http://localhost:3000/dashboard/instagram?instagram=connected"
    );
  });

  it("never leaks the stored access token in the redirect response", async () => {
    const app = createApp();
    const state = await mintState(app);
    mockGraphApiSuccess();

    const response = await request(app)
      .get("/api/instagram/callback")
      .query({ code: "mock-auth-code", state });

    expect(response.text ?? "").not.toMatch(/mock-page-token|mock-token/);
  });

  it("discovers an Instagram account linked via connected_instagram_account (Business Suite link path)", async () => {
    const app = createApp();
    const state = await mintState(app);
    mockGraphApiSuccess({ linkedVia: "connected_instagram_account" });

    const response = await request(app)
      .get("/api/instagram/callback")
      .query({ code: "mock-auth-code", state });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "http://localhost:3000/dashboard/instagram?instagram=connected"
    );

    const status = await request(app)
      .get("/api/instagram/status")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);
    expect(status.body.connected).toBe(true);
    expect(status.body.username).toBe("nehasuresh93");
  });

  it("reports the real per-Page Meta error instead of a generic message when the Page lookup itself fails", async () => {
    const app = createApp();
    const state = await mintState(app);

    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/oauth/access_token")) {
        return new Response(JSON.stringify({ access_token: "mock-token", expires_in: 5184000 }), {
          status: 200,
        });
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
      // Simulate Meta rejecting the per-Page detail lookup (e.g. a
      // permission the Login Configuration didn't actually grant).
      return new Response(
        JSON.stringify({ error: { message: "(#200) Missing permission pages_show_list" } }),
        { status: 400 }
      );
    });

    const response = await request(app)
      .get("/api/instagram/callback")
      .query({ code: "mock-auth-code", state });

    expect(response.status).toBe(302);
    const location = response.headers.location!;
    expect(location.startsWith("http://localhost:3000/dashboard/instagram?instagram=error")).toBe(
      true
    );
    const reason = decodeURIComponent(new URL(location).searchParams.get("reason") ?? "");
    expect(reason).toMatch(/Creatiq Page/);
    expect(reason).toMatch(/Missing permission pages_show_list/);
  });

  // Regression test for a real, confirmed-live failure: Meta's own
  // consent dialog completes successfully, /me/permissions grants
  // every required permission (pages_show_list, instagram_basic,
  // instagram_content_publish, pages_read_engagement), yet
  // /me/accounts still returns an empty data array — meaning the
  // Page is not an asset of the app's Business Portfolio (or the app
  // has no access to it there), not a scope/permission problem.
  it("gives an actionable Business-Portfolio-specific error when /me/accounts returns zero Pages despite granted permissions", async () => {
    const app = createApp();
    const state = await mintState(app);

    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/oauth/access_token")) {
        return new Response(JSON.stringify({ access_token: "mock-token", expires_in: 5184000 }), {
          status: 200,
        });
      }
      // Permissions are granted in this scenario (mirrors the real
      // captured /me/permissions response: pages_show_list,
      // business_management, instagram_basic, instagram_content_publish,
      // pages_read_engagement all "granted") — the point of this test
      // is that /me/accounts is still empty, which is a Business
      // Portfolio asset-access issue, not a permission issue.
      if (url.includes("/me/permissions")) {
        return new Response(JSON.stringify(ALL_GRANTED_PERMISSIONS), { status: 200 });
      }
      if (url.includes("/me/accounts")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "user-1", name: "Test User" }), { status: 200 });
    });

    const response = await request(app)
      .get("/api/instagram/callback")
      .query({ code: "mock-auth-code", state });

    expect(response.status).toBe(302);
    const location = response.headers.location!;
    expect(location.startsWith("http://localhost:3000/dashboard/instagram?instagram=error")).toBe(
      true
    );
    const reason = decodeURIComponent(new URL(location).searchParams.get("reason") ?? "");
    expect(reason).toMatch(/Business Portfolio/i);
    expect(reason).not.toMatch(/no Pages you can manage/i);

    const status = await request(app)
      .get("/api/instagram/status")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);
    expect(status.body.connected).toBe(false);
  });

  // Regression test for the actual confirmed root cause (2026-10-30):
  // business_management was missing from the Login Configuration's
  // permission list. With it absent, /me/accounts returned an empty
  // array even though every other permission was granted and the Page
  // was correctly owned/linked. This must now fail fast with a
  // precise, actionable message naming the missing permission,
  // instead of surfacing later as a confusing empty Page list.
  it("fails fast with a precise message naming business_management when it is the only permission missing", async () => {
    const app = createApp();
    const state = await mintState(app);

    mockGraphApiSuccess({
      permissions: {
        data: [
          { permission: "pages_show_list", status: "granted" },
          { permission: "instagram_basic", status: "granted" },
          { permission: "instagram_content_publish", status: "granted" },
          { permission: "pages_read_engagement", status: "granted" },
          { permission: "public_profile", status: "granted" },
          // business_management intentionally absent — the real bug.
        ],
      },
    });

    const response = await request(app)
      .get("/api/instagram/callback")
      .query({ code: "mock-auth-code", state });

    expect(response.status).toBe(302);
    const location = response.headers.location!;
    expect(location.startsWith("http://localhost:3000/dashboard/instagram?instagram=error")).toBe(
      true
    );
    const reason = decodeURIComponent(new URL(location).searchParams.get("reason") ?? "");
    expect(reason).toMatch(/business_management/);
    expect(reason).not.toMatch(/pages_show_list|instagram_basic/); // only the actually-missing one is named

    const status = await request(app)
      .get("/api/instagram/status")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);
    expect(status.body.connected).toBe(false);
  });

  it("succeeds once all five required permissions (including business_management) are granted", async () => {
    const app = createApp();
    const state = await mintState(app);
    mockGraphApiSuccess();

    const response = await request(app)
      .get("/api/instagram/callback")
      .query({ code: "mock-auth-code", state });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "http://localhost:3000/dashboard/instagram?instagram=connected"
    );

    const status = await request(app)
      .get("/api/instagram/status")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);
    expect(status.body.connected).toBe(true);
  });
});
