import { getSupabaseAdminClient } from "./supabase.service.js";
import { notFound } from "./appError.js";
import type { CreateProjectRequest, UpdateProjectRequest } from "../validation/project.schema.js";

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

function toDto(row: {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as ProjectDto["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(workspaceId: string): Promise<ProjectDto[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, status, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list projects: ${error.message}`);
  }

  return (data ?? []).map(toDto);
}

export async function createProject(
  workspaceId: string,
  userId: string,
  input: CreateProjectRequest
): Promise<ProjectDto> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      description: input.description ?? null,
      created_by: userId,
    })
    .select("id, name, description, status, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create project: ${error?.message ?? "unknown error"}`);
  }

  return toDto(data);
}

async function findProjectRow(workspaceId: string, projectId: string) {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, status, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up project: ${error.message}`);
  }

  return data;
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  input: UpdateProjectRequest
): Promise<ProjectDto> {
  const existing = await findProjectRow(workspaceId, projectId);

  if (!existing) {
    throw notFound("Project");
  }

  const supabase = getSupabaseAdminClient();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .select("id, name, description, status, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update project: ${error?.message ?? "unknown error"}`);
  }

  return toDto(data);
}

export async function deleteProject(workspaceId: string, projectId: string): Promise<void> {
  const existing = await findProjectRow(workspaceId, projectId);

  if (!existing) {
    throw notFound("Project");
  }

  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", projectId);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }
}
