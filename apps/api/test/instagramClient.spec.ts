import { describe, expect, it } from "vitest";
import {
  buildAuthorizationUrl,
  REQUIRED_CONFIG_PERMISSIONS,
} from "../src/services/instagram/instagramClient.js";

describe("buildAuthorizationUrl (Facebook Login for Business)", () => {
  const url = buildAuthorizationUrl({
    appId: "test-app-id",
    redirectUri: "https://api.example.com/api/instagram/callback",
    state: "test-state-value",
    loginConfigId: "test-config-id",
  });
  const params = new URL(url).searchParams;

  it("targets Meta's OAuth dialog host", () => {
    expect(url.startsWith("https://www.facebook.com/")).toBe(true);
  });

  it("includes config_id", () => {
    expect(params.get("config_id")).toBe("test-config-id");
  });

  it("uses response_type=code with override_default_response_type=true", () => {
    expect(params.get("response_type")).toBe("code");
    expect(params.get("override_default_response_type")).toBe("true");
  });

  it("preserves client_id, redirect_uri, and state", () => {
    expect(params.get("client_id")).toBe("test-app-id");
    expect(params.get("redirect_uri")).toBe("https://api.example.com/api/instagram/callback");
    expect(params.get("state")).toBe("test-state-value");
  });

  it("does not include a scope parameter", () => {
    expect(params.has("scope")).toBe(false);
  });
});

describe("REQUIRED_CONFIG_PERMISSIONS", () => {
  // business_management is required in addition to the other four:
  // confirmed via a live Graph API Explorer test (2026-10-30) where
  // /me/accounts returned an empty array without it, and correctly
  // returned the Page once it was added to the Login Configuration.
  it("includes all five permissions the Login Configuration must grant", () => {
    expect(REQUIRED_CONFIG_PERMISSIONS).toEqual(
      expect.arrayContaining([
        "pages_show_list",
        "business_management",
        "instagram_basic",
        "instagram_content_publish",
        "pages_read_engagement",
      ])
    );
    expect(REQUIRED_CONFIG_PERMISSIONS).toHaveLength(5);
  });
});
