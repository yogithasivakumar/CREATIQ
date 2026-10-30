import { loadEnv } from "../../config/env.js";
import { InstagramError } from "./instagramError.js";

export interface MetaAppConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  loginConfigId: string;
}

// Every /api/instagram/* operation that would otherwise call Meta's
// API goes through this first. If any of META_APP_ID/META_APP_SECRET/
// META_REDIRECT_URI/META_LOGIN_CONFIG_ID is missing, every such request
// fails loudly with a clear configuration error instead of attempting
// a call that could never succeed — same pattern as
// NotConfiguredImageGenerationProvider for AI_PROVIDER=cloudflare
// without credentials.
export function requireMetaConfig(): MetaAppConfig {
  const env = loadEnv();

  if (
    !env.META_APP_ID ||
    !env.META_APP_SECRET ||
    !env.META_REDIRECT_URI ||
    !env.META_LOGIN_CONFIG_ID
  ) {
    throw new InstagramError(
      "Instagram publishing is not configured on this server. Set META_APP_ID, META_APP_SECRET, META_REDIRECT_URI, and META_LOGIN_CONFIG_ID — see src/services/instagram/README.md.",
      "not_configured"
    );
  }

  return {
    appId: env.META_APP_ID,
    appSecret: env.META_APP_SECRET,
    redirectUri: env.META_REDIRECT_URI,
    loginConfigId: env.META_LOGIN_CONFIG_ID,
  };
}
