// Persists "Schedule for Later" requests durably, but this codebase
// has no background job runner, cron, or worker process of any kind —
// nothing here automatically publishes a scheduled post when its time
// arrives. A scheduled post sits in status "pending" until a user (or
// a future, separately-built processor) calls publishScheduledPost on
// it. This is intentional and documented rather than silently
// claiming automation that doesn't exist — see
// src/services/instagram/README.md for what real automation would
// require (e.g. a Supabase pg_cron job calling an Edge Function, or
// an external scheduler hitting a dedicated endpoint).

import { getSupabaseAdminClient } from "../supabase.service.js";
import { notFound, AppError } from "../appError.js";
import { getAsset } from "../assets.service.js";
import { publishAssetToInstagram } from "./instagram.service.js";
import { InstagramError } from "./instagramError.js";

export interface ScheduledPostDto {
  id: string;
  assetId: string;
  caption: string;
  hashtags: string[];
  scheduledFor: string;
  status: "pending" | "processing" | "published" | "failed" | "cancelled";
  publishedPostId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ScheduledPostRow {
  id: string;
  asset_id: string;
  caption: string;
  hashtags: string[];
  scheduled_for: string;
  status: ScheduledPostDto["status"];
  published_post_id: string | null;
  error_message: string | null;
  created_at: string;
}

function toDto(row: ScheduledPostRow): ScheduledPostDto {
  return {
    id: row.id,
    assetId: row.asset_id,
    caption: row.caption,
    hashtags: row.hashtags,
    scheduledFor: row.scheduled_for,
    status: row.status,
    publishedPostId: row.published_post_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export async function scheduleInstagramPost(
  workspaceId: string,
  userId: string,
  input: { assetId: string; caption: string; hashtags: string[]; scheduledFor: string }
): Promise<ScheduledPostDto> {
  // Confirms the asset belongs to this workspace before persisting a
  // job that references it (notFound() if not, matching the same
  // ownership-check pattern used everywhere else in this codebase).
  await getAsset(workspaceId, input.assetId);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("scheduled_posts")
    .insert({
      workspace_id: workspaceId,
      asset_id: input.assetId,
      caption: input.caption,
      hashtags: input.hashtags,
      scheduled_for: input.scheduledFor,
      status: "pending",
      created_by: userId,
    })
    .select("id, asset_id, caption, hashtags, scheduled_for, status, published_post_id, error_message, created_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to schedule post: ${error?.message ?? "unknown error"}`);
  }

  return toDto(data as ScheduledPostRow);
}

export async function listScheduledPosts(workspaceId: string): Promise<ScheduledPostDto[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("id, asset_id, caption, hashtags, scheduled_for, status, published_post_id, error_message, created_at")
    .eq("workspace_id", workspaceId)
    .order("scheduled_for", { ascending: true });

  if (error) {
    throw new Error(`Failed to list scheduled posts: ${error.message}`);
  }

  return (data ?? []).map((row) => toDto(row as ScheduledPostRow));
}

async function findScheduledPostRow(
  workspaceId: string,
  postId: string
): Promise<ScheduledPostRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("id, asset_id, caption, hashtags, scheduled_for, status, published_post_id, error_message, created_at")
    .eq("workspace_id", workspaceId)
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up scheduled post: ${error.message}`);
  }

  return data as ScheduledPostRow | null;
}

// Manually triggers publishing of a pending scheduled post — the
// honest stand-in for real automated scheduling (see module doc
// comment). A user clicks "Publish Now" on a due scheduled post from
// the Scheduled Posts list; this does not run on its own.
export async function publishScheduledPost(
  workspaceId: string,
  postId: string
): Promise<ScheduledPostDto> {
  const row = await findScheduledPostRow(workspaceId, postId);

  if (!row) {
    throw notFound("Scheduled post");
  }

  if (row.status !== "pending" && row.status !== "failed") {
    throw new AppError(409, `This post is already ${row.status}.`);
  }

  const supabase = getSupabaseAdminClient();
  await supabase
    .from("scheduled_posts")
    .update({ status: "processing" })
    .eq("workspace_id", workspaceId)
    .eq("id", postId);

  try {
    const result = await publishAssetToInstagram(workspaceId, row.asset_id, row.caption);

    const { data, error } = await supabase
      .from("scheduled_posts")
      .update({ status: "published", published_post_id: result.instagramMediaId, error_message: null })
      .eq("workspace_id", workspaceId)
      .eq("id", postId)
      .select("id, asset_id, caption, hashtags, scheduled_for, status, published_post_id, error_message, created_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to record publish result: ${error?.message ?? "unknown error"}`);
    }

    return toDto(data as ScheduledPostRow);
  } catch (error) {
    const message =
      error instanceof InstagramError || error instanceof Error
        ? error.message
        : "Publishing failed for an unknown reason.";

    await supabase
      .from("scheduled_posts")
      .update({ status: "failed", error_message: message })
      .eq("workspace_id", workspaceId)
      .eq("id", postId);

    throw error;
  }
}

export async function cancelScheduledPost(workspaceId: string, postId: string): Promise<void> {
  const row = await findScheduledPostRow(workspaceId, postId);

  if (!row) {
    throw notFound("Scheduled post");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("scheduled_posts")
    .update({ status: "cancelled" })
    .eq("workspace_id", workspaceId)
    .eq("id", postId);

  if (error) {
    throw new Error(`Failed to cancel scheduled post: ${error.message}`);
  }
}
