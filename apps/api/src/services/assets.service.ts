import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "./supabase.service.js";
import { loadEnv } from "../config/env.js";
import { InvalidImageOutputError, validateJpegOutput } from "./ai/imageValidation.js";
import { AppError, notFound } from "./appError.js";
import type {
  ListAssetsQuery,
  SaveAssetRequest,
  UpdateAssetProjectRequest,
} from "../validation/asset.schema.js";

export interface AssetDto {
  id: string;
  projectId: string | null;
  prompt: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  createdAt: string;
  url: string;
}

const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes — plenty for a page view/download click.

interface AssetRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  storage_key: string;
  prompt: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

async function toDto(row: AssetRow): Promise<AssetDto> {
  const env = loadEnv();
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(row.storage_key, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? "unknown error"}`);
  }

  return {
    id: row.id,
    projectId: row.project_id,
    prompt: row.prompt,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    fileSizeBytes: row.file_size_bytes,
    createdAt: row.created_at,
    url: data.signedUrl,
  };
}

export interface AssetPage {
  items: AssetDto[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listAssets(
  workspaceId: string,
  query: ListAssetsQuery
): Promise<AssetPage> {
  const supabase = getSupabaseAdminClient();

  let builder = supabase
    .from("assets")
    .select(
      "id, workspace_id, project_id, storage_key, prompt, mime_type, width, height, file_size_bytes, created_at",
      { count: "exact" }
    )
    .eq("workspace_id", workspaceId)
    .eq("asset_type", "image");

  if (query.projectId) {
    builder = builder.eq("project_id", query.projectId);
  }

  if (query.search) {
    // Matches against the stored prompt and the original filename —
    // the two human-readable fields a user would recognize an asset by.
    const escaped = query.search.replace(/[%_]/g, (c) => `\\${c}`);
    builder = builder.or(
      `prompt.ilike.%${escaped}%,original_filename.ilike.%${escaped}%`
    );
  }

  builder = builder.order("created_at", { ascending: query.sort === "oldest" });

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  builder = builder.range(from, to);

  const { data, error, count } = await builder;

  if (error) {
    throw new Error(`Failed to list assets: ${error.message}`);
  }

  const items = await Promise.all((data ?? []).map((row) => toDto(row as AssetRow)));

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? items.length,
  };
}

// Confirms a project id belongs to the caller's own workspace before
// any asset is linked to it — the one check standing between "assign
// to my project" and an IDOR that links an asset into someone else's
// project by guessing/brute-forcing a UUID.
async function assertProjectInWorkspace(workspaceId: string, projectId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    throw new Error(`Failed to verify project: ${projectError.message}`);
  }

  if (!project) {
    throw notFound("Project");
  }
}

async function findAssetRow(workspaceId: string, assetId: string): Promise<AssetRow | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("assets")
    .select(
      "id, workspace_id, project_id, storage_key, prompt, mime_type, width, height, file_size_bytes, created_at"
    )
    .eq("workspace_id", workspaceId)
    .eq("id", assetId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up asset: ${error.message}`);
  }

  return data as AssetRow | null;
}

export async function getAsset(workspaceId: string, assetId: string): Promise<AssetDto> {
  const row = await findAssetRow(workspaceId, assetId);

  if (!row) {
    throw notFound("Asset");
  }

  return toDto(row);
}

// Assigns an existing library asset to a project, moves it between
// projects, or clears its assignment (projectId: null) — "No project".
// Both the asset and (when non-null) the target project must already
// belong to the caller's own workspace; this never touches the file
// in storage, only the assets.project_id column.
export async function updateAssetProject(
  workspaceId: string,
  assetId: string,
  input: UpdateAssetProjectRequest
): Promise<AssetDto> {
  const existing = await findAssetRow(workspaceId, assetId);

  if (!existing) {
    throw notFound("Asset");
  }

  if (input.projectId !== null) {
    await assertProjectInWorkspace(workspaceId, input.projectId);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ project_id: input.projectId })
    .eq("workspace_id", workspaceId)
    .eq("id", assetId)
    .select(
      "id, workspace_id, project_id, storage_key, prompt, mime_type, width, height, file_size_bytes, created_at"
    )
    .single();

  if (error || !data) {
    throw new Error(`Failed to update asset's project: ${error?.message ?? "unknown error"}`);
  }

  return toDto(data as AssetRow);
}

// Validates and project-checks the image, uploads it to the private
// bucket under <workspace_id>/<uuid>.jpg (matching the storage RLS
// convention), and records it using the existing generation_jobs /
// generation_outputs / assets schema — a "save to library" click is
// modeled as a completed, backend-recorded generation job rather than
// a new, parallel concept.
export async function saveGeneratedAsset(
  workspaceId: string,
  userId: string,
  input: SaveAssetRequest
): Promise<AssetDto> {
  let validated;
  try {
    validated = validateJpegOutput(input.image);
  } catch (error) {
    if (error instanceof InvalidImageOutputError) {
      throw new AppError(400, error.message);
    }
    throw error;
  }

  const buffer = Buffer.from(input.image, "base64");

  if (input.projectId) {
    await assertProjectInWorkspace(workspaceId, input.projectId);
  }

  const env = loadEnv();
  const supabase = getSupabaseAdminClient();
  const storageKey = `${workspaceId}/${randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(storageKey, buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload asset: ${uploadError.message}`);
  }

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .insert({
      workspace_id: workspaceId,
      requested_by: userId,
      status: "succeeded",
      prompt: input.prompt ?? "(no prompt recorded)",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobError || !job) {
    await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([storageKey]);
    throw new Error(`Failed to record generation job: ${jobError?.message ?? "unknown error"}`);
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      workspace_id: workspaceId,
      project_id: input.projectId ?? null,
      storage_key: storageKey,
      mime_type: "image/jpeg",
      file_size_bytes: validated.byteLength,
      width: validated.width,
      height: validated.height,
      asset_type: "image",
      prompt: input.prompt ?? null,
      created_by: userId,
    })
    .select(
      "id, workspace_id, project_id, storage_key, prompt, mime_type, width, height, file_size_bytes, created_at"
    )
    .single();

  if (assetError || !asset) {
    await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([storageKey]);
    throw new Error(`Failed to record asset: ${assetError?.message ?? "unknown error"}`);
  }

  const { error: outputError } = await supabase.from("generation_outputs").insert({
    workspace_id: workspaceId,
    job_id: job.id,
    asset_id: asset.id,
  });

  if (outputError) {
    throw new Error(`Failed to link generation output: ${outputError.message}`);
  }

  return toDto(asset as AssetRow);
}

export async function deleteAsset(workspaceId: string, assetId: string): Promise<void> {
  const row = await findAssetRow(workspaceId, assetId);

  if (!row) {
    throw notFound("Asset");
  }

  const env = loadEnv();
  const supabase = getSupabaseAdminClient();

  const { error: storageError } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .remove([row.storage_key]);

  if (storageError) {
    throw new Error(`Failed to delete asset file: ${storageError.message}`);
  }

  const { error: dbError } = await supabase
    .from("assets")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", assetId);

  if (dbError) {
    throw new Error(`Failed to delete asset record: ${dbError.message}`);
  }
}
