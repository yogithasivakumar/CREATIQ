import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "../supabase.service.js";
import { getAsset } from "../assets.service.js";
import { notFound } from "../appError.js";
import { InstagramError } from "./instagramError.js";
import { requireMetaConfig } from "./instagramConfig.js";
import {
  buildAuthorizationUrl,
  discoverInstagramAccount,
  exchangeCodeForLongLivedToken,
  fetchInstagramUsername,
  publishImagePost,
} from "./instagramClient.js";

export interface InstagramConnectionStatus {
  connected: boolean;
  username: string | null;
  status: "connected" | "expired" | "revoked" | null;
}

interface ConnectionRow {
  workspace_id: string;
  instagram_business_account_id: string;
  instagram_username: string | null;
  access_token: string;
  token_expires_at: string | null;
  status: "connected" | "expired" | "revoked";
}

// In-memory OAuth state store, mapping a random `state` value to the
// workspace/user that started the flow. This is single-process and
// non-durable (same documented limitation as generationRateLimiter.ts)
// — acceptable here because the state token only needs to survive the
// few seconds between redirecting to Meta and Meta redirecting back,
// not across a server restart.
const pendingOAuthStates = new Map<string, { userId: string; workspaceId: string; createdAt: number }>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [state, entry] of pendingOAuthStates) {
    if (now - entry.createdAt > OAUTH_STATE_TTL_MS) {
      pendingOAuthStates.delete(state);
    }
  }
}

export function startInstagramConnect(userId: string, workspaceId: string): string {
  const config = requireMetaConfig();
  cleanupExpiredStates();

  const state = randomUUID();
  pendingOAuthStates.set(state, { userId, workspaceId, createdAt: Date.now() });

  return buildAuthorizationUrl({
    appId: config.appId,
    redirectUri: config.redirectUri,
    state,
    loginConfigId: config.loginConfigId,
  });
}

export async function completeInstagramConnect(
  code: string,
  state: string
): Promise<{ workspaceId: string }> {
  const config = requireMetaConfig();

  const pending = pendingOAuthStates.get(state);
  if (!pending) {
    throw new InstagramError(
      "This Instagram connection request has expired or was not recognized. Please try connecting again.",
      "invalid_media"
    );
  }
  pendingOAuthStates.delete(state);

  const { accessToken, expiresInSeconds, shortLivedAccessToken } = await exchangeCodeForLongLivedToken({
    appId: config.appId,
    appSecret: config.appSecret,
    redirectUri: config.redirectUri,
    code,
  });

  const account = await discoverInstagramAccount(accessToken, shortLivedAccessToken);
  const username = await fetchInstagramUsername(
    account.instagramBusinessAccountId,
    account.pageAccessToken
  );

  const supabase = getSupabaseAdminClient();
  const expiresAt = expiresInSeconds
    ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    : null;

  const { error } = await supabase.from("instagram_connections").upsert(
    {
      workspace_id: pending.workspaceId,
      meta_user_id: pending.userId,
      instagram_business_account_id: account.instagramBusinessAccountId,
      instagram_username: username,
      // The Page access token (not the short-lived user token) is
      // what Meta's publishing calls actually require.
      access_token: account.pageAccessToken,
      token_expires_at: expiresAt,
      status: "connected",
      connected_by: pending.userId,
    },
    { onConflict: "workspace_id" }
  );

  if (error) {
    throw new Error(`Failed to store Instagram connection: ${error.message}`);
  }

  return { workspaceId: pending.workspaceId };
}

async function findConnection(workspaceId: string): Promise<ConnectionRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("instagram_connections")
    .select(
      "workspace_id, instagram_business_account_id, instagram_username, access_token, token_expires_at, status"
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up Instagram connection: ${error.message}`);
  }

  return data as ConnectionRow | null;
}

export async function getInstagramStatus(workspaceId: string): Promise<InstagramConnectionStatus> {
  const connection = await findConnection(workspaceId);

  if (!connection) {
    return { connected: false, username: null, status: null };
  }

  const isExpired =
    connection.token_expires_at !== null && new Date(connection.token_expires_at) < new Date();

  return {
    connected: connection.status === "connected" && !isExpired,
    username: connection.instagram_username,
    status: isExpired ? "expired" : connection.status,
  };
}

export async function disconnectInstagram(workspaceId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("instagram_connections")
    .delete()
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to disconnect Instagram: ${error.message}`);
  }
}

async function requireActiveConnection(workspaceId: string): Promise<ConnectionRow> {
  requireMetaConfig();

  const connection = await findConnection(workspaceId);

  if (!connection || connection.status !== "connected") {
    throw new InstagramError(
      "No Instagram account is connected. Connect one from Settings or Instagram Publishing first.",
      "not_connected"
    );
  }

  if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
    throw new InstagramError(
      "Your Instagram connection has expired. Please reconnect your account.",
      "token_expired"
    );
  }

  return connection;
}

export interface PublishResult {
  instagramMediaId: string;
}

// Publishes an existing library asset directly to Instagram. The
// asset must already belong to the caller's workspace (getAsset
// enforces this); its signed URL (valid for 10 minutes, see
// assets.service.ts) is what Meta fetches to build the media
// container — well within the window a single publish call needs.
export async function publishAssetToInstagram(
  workspaceId: string,
  assetId: string,
  caption: string
): Promise<PublishResult> {
  const connection = await requireActiveConnection(workspaceId);
  const asset = await getAsset(workspaceId, assetId);

  if (!asset) {
    throw notFound("Asset");
  }

  if (asset.mimeType !== "image/jpeg") {
    throw new InstagramError(
      "Only JPEG images can be published to Instagram.",
      "invalid_media"
    );
  }

  const result = await publishImagePost({
    instagramBusinessAccountId: connection.instagram_business_account_id,
    accessToken: connection.access_token,
    imageUrl: asset.url,
    caption,
  });

  return { instagramMediaId: result.instagramMediaId };
}
