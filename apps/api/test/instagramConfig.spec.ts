import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvForTests } from "../src/config/env.js";
import { requireMetaConfig } from "../src/services/instagram/instagramConfig.js";
import { InstagramError } from "../src/services/instagram/instagramError.js";

const BASE_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_SECRET_KEY: "test-secret-key",
};

const FULL_META_ENV = {
  META_APP_ID: "test-app-id",
  META_APP_SECRET: "test-app-secret",
  META_REDIRECT_URI: "https://api.example.com/api/instagram/callback",
  META_LOGIN_CONFIG_ID: "test-login-config-id",
};

function withEnv(overrides: Record<string, string | undefined>) {
  const original = { ...process.env };

  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    process.env = original;
  };
}

describe("requireMetaConfig", () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    resetEnvForTests();
  });

  afterEach(() => {
    restoreEnv?.();
    resetEnvForTests();
  });

  it("returns appId, appSecret, redirectUri, and loginConfigId when all four are set", () => {
    restoreEnv = withEnv(FULL_META_ENV);

    const config = requireMetaConfig();

    expect(config).toEqual({
      appId: "test-app-id",
      appSecret: "test-app-secret",
      redirectUri: "https://api.example.com/api/instagram/callback",
      loginConfigId: "test-login-config-id",
    });
  });

  it("throws a not_configured InstagramError when META_LOGIN_CONFIG_ID is missing", () => {
    restoreEnv = withEnv({ ...FULL_META_ENV, META_LOGIN_CONFIG_ID: undefined });

    expect(() => requireMetaConfig()).toThrow(InstagramError);
    try {
      requireMetaConfig();
    } catch (error) {
      expect(error).toBeInstanceOf(InstagramError);
      expect((error as InstagramError).kind).toBe("not_configured");
    }
  });

  it("throws a not_configured InstagramError when no META_* vars are set", () => {
    restoreEnv = withEnv({
      META_APP_ID: undefined,
      META_APP_SECRET: undefined,
      META_REDIRECT_URI: undefined,
      META_LOGIN_CONFIG_ID: undefined,
    });

    expect(() => requireMetaConfig()).toThrow(/not configured/i);
  });
});
