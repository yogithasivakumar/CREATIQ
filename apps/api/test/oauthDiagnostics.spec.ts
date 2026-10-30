import { existsSync, readFileSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvForTests } from "../src/config/env.js";
import { isOauthDebugEnabled, recordOauthDebugEvent } from "../src/services/instagram/oauthDiagnostics.js";

const DEBUG_FILE = "oauth-debug.local.jsonl";

const BASE_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_SECRET_KEY: "test-secret-key",
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

function cleanupDebugFile() {
  if (existsSync(DEBUG_FILE)) rmSync(DEBUG_FILE);
}

describe("oauthDiagnostics", () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    resetEnvForTests();
    cleanupDebugFile();
  });

  afterEach(() => {
    restoreEnv?.();
    resetEnvForTests();
    cleanupDebugFile();
  });

  it("is disabled by default (INSTAGRAM_OAUTH_DEBUG unset)", () => {
    restoreEnv = withEnv({ INSTAGRAM_OAUTH_DEBUG: undefined });
    expect(isOauthDebugEnabled()).toBe(false);
  });

  it("is disabled in production even if INSTAGRAM_OAUTH_DEBUG=1", () => {
    restoreEnv = withEnv({ NODE_ENV: "production", INSTAGRAM_OAUTH_DEBUG: "1" });
    expect(isOauthDebugEnabled()).toBe(false);
  });

  it("is enabled only when explicitly set to 1 outside production", () => {
    restoreEnv = withEnv({ NODE_ENV: "development", INSTAGRAM_OAUTH_DEBUG: "1" });
    expect(isOauthDebugEnabled()).toBe(true);
  });

  it("writes nothing when disabled", () => {
    restoreEnv = withEnv({ INSTAGRAM_OAUTH_DEBUG: undefined });
    recordOauthDebugEvent("test event", { access_token: "should-not-be-written-at-all" });
    expect(existsSync(DEBUG_FILE)).toBe(false);
  });

  it("redacts every token-named field, at any nesting depth, when enabled", () => {
    restoreEnv = withEnv({ NODE_ENV: "development", INSTAGRAM_OAUTH_DEBUG: "1" });

    recordOauthDebugEvent("GET /me/accounts", {
      data: [
        {
          id: "page-123",
          access_token: "super-secret-page-token",
          nested: { fb_exchange_token: "super-secret-exchange-token" },
        },
      ],
    });

    const written = readFileSync(DEBUG_FILE, "utf8");
    expect(written).not.toMatch(/super-secret/);
    expect(written).toMatch(/\[REDACTED\]/);

    const parsed = JSON.parse(written.trim());
    expect(parsed.label).toBe("GET /me/accounts");
    expect(parsed.payload.data[0].access_token).toBe("[REDACTED]");
    expect(parsed.payload.data[0].nested.fb_exchange_token).toBe("[REDACTED]");
    expect(parsed.payload.data[0].id).toBe("page-123");
  });
});
