// Thin wrapper around Meta's Graph API for the Facebook-Login-for-
// Business path to Instagram publishing (instagram_basic,
// instagram_content_publish, pages_read_engagement scopes; host
// graph.facebook.com). Verified against Meta's own developer docs
// (developers.facebook.com/docs/instagram-platform/..., retrieved
// 2026-10-29) — re-check before relying on this if Meta has since
// changed the API version or flow.
//
// Nothing here is reachable unless META_APP_ID/META_APP_SECRET/
// META_REDIRECT_URI are all set (see instagramConfig.ts) — every
// function below assumes its caller already checked that.

import { InstagramError } from "./instagramError.js";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const OAUTH_DIALOG_BASE = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;

// instagram_basic: read the connected Instagram account.
// instagram_content_publish: publish media to it.
// pages_read_engagement: required to read the Page's connected
// Instagram Business Account via /me/accounts.
const OAUTH_SCOPES = ["instagram_basic", "instagram_content_publish", "pages_read_engagement"];

export function buildAuthorizationUrl(config: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    scope: OAUTH_SCOPES.join(","),
    response_type: "code",
    state: config.state,
  });

  return `${OAUTH_DIALOG_BASE}?${params.toString()}`;
}

interface ShortLivedTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

async function graphFetch<T>(url: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new InstagramError("Could not reach Meta's Graph API.", "provider_error", error);
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw new InstagramError(
      "Meta's Graph API returned an unreadable response.",
      "provider_error",
      error
    );
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error?: { message?: string } }).error?.message ?? "")
        : "";

    if (response.status === 429) {
      throw new InstagramError(
        "Meta's API is rate-limiting this app. Please try again shortly.",
        "rate_limited"
      );
    }

    throw new InstagramError(
      message || `Meta's Graph API request failed with status ${response.status}.`,
      "provider_error"
    );
  }

  return payload as T;
}

// Exchanges the OAuth authorization code for a short-lived user
// access token, then immediately exchanges that for a long-lived
// token (~60 days) in the same call chain — the short-lived token is
// never persisted.
export async function exchangeCodeForLongLivedToken(config: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ accessToken: string; expiresInSeconds: number | null }> {
  const codeParams = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code: config.code,
  });

  const shortLived = await graphFetch<ShortLivedTokenResponse>(
    `${GRAPH_API_BASE}/oauth/access_token?${codeParams.toString()}`
  );

  const exchangeParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortLived.access_token,
  });

  const longLived = await graphFetch<ShortLivedTokenResponse>(
    `${GRAPH_API_BASE}/oauth/access_token?${exchangeParams.toString()}`
  );

  return {
    accessToken: longLived.access_token,
    expiresInSeconds: longLived.expires_in ?? null,
  };
}

interface PagesResponse {
  data: {
    id: string;
    name?: string;
    access_token: string;
    instagram_business_account?: { id: string };
  }[];
}

export interface DiscoveredInstagramAccount {
  instagramBusinessAccountId: string;
  pageAccessToken: string;
}

// Finds the first Facebook Page (among those the user granted access
// to) that has a connected Instagram Business/Creator account. If the
// user manages multiple Pages with different connected Instagram
// accounts, this takes the first match — a real multi-Page picker is
// out of scope here and would be a natural follow-up.
export async function discoverInstagramAccount(
  userAccessToken: string
): Promise<DiscoveredInstagramAccount> {
  const params = new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account",
    access_token: userAccessToken,
  });

  const pages = await graphFetch<PagesResponse>(`${GRAPH_API_BASE}/me/accounts?${params.toString()}`);

  const pageWithInstagram = pages.data.find((page) => page.instagram_business_account?.id);

  if (!pageWithInstagram?.instagram_business_account) {
    throw new InstagramError(
      "No Instagram Business or Creator account is connected to any of your Facebook Pages. Connect one in your Facebook Page settings, then try again.",
      "invalid_media"
    );
  }

  return {
    instagramBusinessAccountId: pageWithInstagram.instagram_business_account.id,
    pageAccessToken: pageWithInstagram.access_token,
  };
}

interface InstagramAccountInfo {
  id: string;
  username?: string;
}

export async function fetchInstagramUsername(
  instagramBusinessAccountId: string,
  accessToken: string
): Promise<string | null> {
  const params = new URLSearchParams({ fields: "username", access_token: accessToken });

  const info = await graphFetch<InstagramAccountInfo>(
    `${GRAPH_API_BASE}/${instagramBusinessAccountId}?${params.toString()}`
  );

  return info.username ?? null;
}

interface MediaContainerResponse {
  id: string;
}

// Publishes a single image post: create the media container (Meta
// fetches imageUrl itself — it must be a real, publicly reachable
// JPEG URL at the moment of this call, which a short-lived Supabase
// Storage signed URL satisfies), then publish it. JPEG is the only
// format the Content Publishing API accepts for image posts — this
// matches what the generation pipeline already produces, so no format
// conversion is needed.
export async function publishImagePost(config: {
  instagramBusinessAccountId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<{ instagramMediaId: string }> {
  const createParams = new URLSearchParams({
    image_url: config.imageUrl,
    caption: config.caption,
    access_token: config.accessToken,
  });

  let container: MediaContainerResponse;

  try {
    container = await graphFetch<MediaContainerResponse>(
      `${GRAPH_API_BASE}/${config.instagramBusinessAccountId}/media?${createParams.toString()}`
    );
  } catch (error) {
    if (error instanceof InstagramError) {
      throw new InstagramError(
        `Instagram rejected the image: ${error.message}`,
        "invalid_media",
        error
      );
    }
    throw error;
  }

  const publishParams = new URLSearchParams({
    creation_id: container.id,
    access_token: config.accessToken,
  });

  const published = await graphFetch<MediaContainerResponse>(
    `${GRAPH_API_BASE}/${config.instagramBusinessAccountId}/media_publish?${publishParams.toString()}`
  );

  return { instagramMediaId: published.id };
}
