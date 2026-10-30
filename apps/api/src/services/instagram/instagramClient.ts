// Thin wrapper around Meta's Graph API for the Facebook-Login-for-
// Business path to Instagram publishing (instagram_basic,
// instagram_content_publish, pages_read_engagement, pages_show_list,
// business_management permissions bundled into the Login
// Configuration's config_id; host graph.facebook.com). Verified
// against Meta's own developer docs (developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started,
// retrieved 2026-10-30) — re-check before relying on this if Meta has
// since changed the API version or flow.
//
// business_management is required in addition to the four permissions
// above: confirmed via a live Graph API Explorer test (2026-10-30) —
// with it absent, GET /me/accounts returned an empty array even
// though the user had Full Control of the Page in its Business
// Portfolio, every other permission was granted, and the Page/
// Instagram account were correctly linked in both directions. Adding
// business_management to the Login Configuration's permission list
// made /me/accounts correctly return the Page (with MANAGE and
// CREATE_CONTENT tasks).
//
// Nothing here is reachable unless META_APP_ID/META_APP_SECRET/
// META_REDIRECT_URI are all set (see instagramConfig.ts) — every
// function below assumes its caller already checked that.

import { InstagramError } from "./instagramError.js";
import { isOauthDebugEnabled, recordOauthDebugEvent } from "./oauthDiagnostics.js";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const OAUTH_DIALOG_BASE = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;

// Under Facebook Login for Business, permissions are bundled into a
// Login Configuration (config_id) created in the App Dashboard rather
// than passed as a `scope` list here — the Configuration itself must
// grant all five of these. This constant documents that requirement
// and is checked against /me/permissions when diagnostics are on
// (see checkRequiredPermissions below); it is never sent on the wire.
export const REQUIRED_CONFIG_PERMISSIONS = [
  "pages_show_list",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "pages_read_engagement",
] as const;

export function buildAuthorizationUrl(config: {
  appId: string;
  redirectUri: string;
  state: string;
  loginConfigId: string;
}): string {
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    config_id: config.loginConfigId,
    response_type: "code",
    override_default_response_type: "true",
    state: config.state,
  });

  return `${OAUTH_DIALOG_BASE}?${params.toString()}`;
}

interface ShortLivedTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

async function graphFetch<T>(url: string, method: "GET" | "POST" = "GET"): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, { method });
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
}): Promise<{ accessToken: string; expiresInSeconds: number | null; shortLivedAccessToken: string }> {
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
    // Returned so discoverInstagramAccount can, only when diagnostics
    // are enabled, test /me/accounts against this token too — to
    // prove or rule out whether the fb_exchange_token step itself
    // (documented for the classic scope-based dialog, not verified
    // for config_id-based Facebook Login for Business tokens) is what
    // narrows or loses the Business Portfolio's Page scope.
    shortLivedAccessToken: shortLived.access_token,
  };
}

interface PagesResponse {
  data: {
    id: string;
    name?: string;
    access_token: string;
  }[];
}

// The Page object exposes the linked Instagram account under one of
// two different fields depending on how it was linked:
//  - instagram_business_account: set when the Instagram account was
//    linked via the "convert to professional account" / Graph API
//    business-conversion flow.
//  - connected_instagram_account: set when it was linked from the
//    Page's own Settings -> Linked Accounts (which is also what Meta
//    Business Suite's Page/Instagram linking produces).
// Meta's own "Instagram API with Facebook Login" get-started guide
// discovers this per-Page via a dedicated GET /{page-id} call (not a
// nested field on /me/accounts), using the User access token — that
// per-Page shape is what this function follows.
interface PageInstagramFieldsResponse {
  id: string;
  instagram_business_account?: { id: string };
  connected_instagram_account?: { id: string };
}

export interface DiscoveredInstagramAccount {
  instagramBusinessAccountId: string;
  pageAccessToken: string;
  pageId: string;
  pageName?: string;
}

// Finds the first Facebook Page (among those the user granted access
// to) that has a linked Instagram Business/Creator account — checking
// both fields a linked account can appear under (see above). If the
// user manages multiple Pages with different connected Instagram
// accounts, this takes the first match — a real multi-Page picker is
// out of scope here and would be a natural follow-up.
interface PermissionsResponse {
  data: { permission: string; status: "granted" | "declined" }[];
}

// Checks the live token's actual granted permissions against what
// this flow requires, unconditionally (not just under diagnostics) —
// a missing permission here (e.g. business_management, confirmed
// live on 2026-10-30 to be required alongside the other four: without
// it, /me/accounts returned an empty array even with Page Full
// Control, correct Business Portfolio ownership, and a correctly
// linked Instagram account) must fail with a precise, actionable
// message instead of surfacing later as a confusing empty Page list.
async function verifyRequiredPermissions(userAccessToken: string): Promise<void> {
  const params = new URLSearchParams({ access_token: userAccessToken });
  const permissions = await graphFetch<PermissionsResponse>(
    `${GRAPH_API_BASE}/me/permissions?${params.toString()}`
  );
  recordOauthDebugEvent("GET /me/permissions", permissions);

  const granted = new Set(
    permissions.data.filter((entry) => entry.status === "granted").map((entry) => entry.permission)
  );
  const missing = REQUIRED_CONFIG_PERMISSIONS.filter((permission) => !granted.has(permission));

  if (missing.length > 0) {
    throw new InstagramError(
      `Instagram connection is missing required Meta permission(s): ${missing.join(", ")}. ` +
        "In the Meta App Dashboard, open Facebook Login for Business > Configurations > this app's Configuration, " +
        "add the missing permission(s) to its Permissions list, then reconnect.",
      "invalid_media"
    );
  }
}

export async function discoverInstagramAccount(
  userAccessToken: string,
  debugOnlyShortLivedToken?: string
): Promise<DiscoveredInstagramAccount> {
  await verifyRequiredPermissions(userAccessToken);

  if (isOauthDebugEnabled()) {
    const meParams = new URLSearchParams({ fields: "id,name", access_token: userAccessToken });
    try {
      const me = await graphFetch<unknown>(`${GRAPH_API_BASE}/me?${meParams.toString()}`);
      recordOauthDebugEvent("GET /me", me);
    } catch (error) {
      recordOauthDebugEvent("GET /me (failed)", {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    // Proves or rules out whether fb_exchange_token (documented for
    // the classic scope-based dialog, not verified for config_id-based
    // Facebook Login for Business tokens) is what narrows/loses the
    // Page scope, by calling /me/accounts with the pre-exchange
    // short-lived token for direct comparison against the post-
    // exchange long-lived token's result (captured below as usual).
    if (debugOnlyShortLivedToken) {
      const shortLivedListParams = new URLSearchParams({
        fields: "id,name,access_token",
        access_token: debugOnlyShortLivedToken,
      });
      try {
        const shortLivedPages = await graphFetch<PagesResponse>(
          `${GRAPH_API_BASE}/me/accounts?${shortLivedListParams.toString()}`
        );
        recordOauthDebugEvent(
          "GET /me/accounts USING PRE-EXCHANGE SHORT-LIVED TOKEN (comparison only)",
          shortLivedPages
        );
      } catch (error) {
        recordOauthDebugEvent("GET /me/accounts USING PRE-EXCHANGE SHORT-LIVED TOKEN (failed)", {
          message: error instanceof InstagramError ? error.message : String(error),
        });
      }
    }
  }

  const listParams = new URLSearchParams({
    fields: "id,name,access_token",
    access_token: userAccessToken,
  });

  const pages = await graphFetch<PagesResponse>(
    `${GRAPH_API_BASE}/me/accounts?${listParams.toString()}`
  );
  recordOauthDebugEvent("GET /me/accounts?fields=id,name,access_token", pages);

  // An empty list here with pages_show_list already granted (verified
  // via /me/permissions above when diagnostics are on) is not "no
  // Pages exist" — it means this app cannot see any Page the user
  // administers, which happens when the Page is not added as an asset
  // of the same Meta Business Portfolio the app's Login Configuration
  // is scoped to (or the app itself hasn't been granted access to that
  // Page within the Portfolio). Granting a user permission and the
  // app having Page access are two separate Meta authorization layers.
  if (pages.data.length === 0) {
    throw new InstagramError(
      "Meta returned no Facebook Pages for this account, even though Page permissions were granted. " +
        "This usually means the Facebook Page is not added as an asset of the Business Portfolio this app belongs to, " +
        "or the app hasn't been given access to that Page within the Portfolio. " +
        "In Meta Business Settings, go to Accounts > Pages, confirm the Page is listed under this app's Business Portfolio, " +
        "and that this app has access to it — then reconnect.",
      "invalid_media"
    );
  }

  const lookupErrors: string[] = [];

  for (const page of pages.data) {
    const detailParams = new URLSearchParams({
      fields: "id,name,instagram_business_account,connected_instagram_account",
      access_token: userAccessToken,
    });

    let detail: PageInstagramFieldsResponse;
    try {
      detail = await graphFetch<PageInstagramFieldsResponse>(
        `${GRAPH_API_BASE}/${page.id}?${detailParams.toString()}`
      );
      recordOauthDebugEvent(`GET /${page.id} (${page.name ?? "unnamed"})`, detail);
    } catch (error) {
      recordOauthDebugEvent(`GET /${page.id} (${page.name ?? "unnamed"}) (failed)`, {
        message: error instanceof InstagramError ? error.message : String(error),
      });
      // Surface the real Meta error for this Page instead of silently
      // skipping it — a permission/scope error here (e.g. the login
      // Configuration not granting pages_show_list) looks identical to
      // "no Instagram account" unless reported explicitly.
      lookupErrors.push(
        `Page "${page.name ?? page.id}": ${error instanceof InstagramError ? error.message : "lookup failed"}`
      );
      continue;
    }

    const instagramAccountId =
      detail.instagram_business_account?.id ?? detail.connected_instagram_account?.id;

    if (instagramAccountId) {
      return {
        instagramBusinessAccountId: instagramAccountId,
        pageAccessToken: page.access_token,
        pageId: page.id,
        pageName: page.name,
      };
    }
  }

  const detailSuffix = lookupErrors.length > 0 ? ` (${lookupErrors.join("; ")})` : "";

  throw new InstagramError(
    `No Instagram Business or Creator account is connected to any of your Facebook Pages.${detailSuffix} In Meta Business Suite, confirm the Instagram account is linked to this Page, then try connecting again.`,
    "invalid_media"
  );
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
//
// Both /media and /media_publish are write operations and MUST be
// POST — sending them as GET (the bug fixed 2026-10-30) makes Graph
// API parse the edge name as a field read instead of an action,
// producing the exact confirmed-live error
// "(#100) Tried accessing nonexisting field (media_publish)" for the
// second call (the first, /media, can appear to partially work as a
// GET since Meta also supports reading a container's status that
// way, which made this bug easy to miss on the first call alone).
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
      `${GRAPH_API_BASE}/${config.instagramBusinessAccountId}/media?${createParams.toString()}`,
      "POST"
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
    `${GRAPH_API_BASE}/${config.instagramBusinessAccountId}/media_publish?${publishParams.toString()}`,
    "POST"
  );

  return { instagramMediaId: published.id };
}
