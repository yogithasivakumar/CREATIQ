import { getSupabaseAdminClient } from "./supabase.service.js";

const DEFAULT_WORKSPACE_NAME = "My Workspace";

// Every project/asset operation is scoped to a workspace, but there is
// still no workspace creation UI. Until one exists, each user gets a
// single personal workspace, created on first use and reused after
// that (first membership row found, ordered by join date).
export async function getOrCreateDefaultWorkspace(
  userId: string
): Promise<string> {
  const supabase = getSupabaseAdminClient();

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Failed to look up workspace membership: ${membershipError.message}`);
  }

  if (membership) {
    return membership.workspace_id as string;
  }

  const { data: created, error: createError } = await supabase
    .from("workspaces")
    .insert({ name: DEFAULT_WORKSPACE_NAME, owner_id: userId })
    .select("id")
    .single();

  if (createError || !created) {
    throw new Error(
      `Failed to create default workspace: ${createError?.message ?? "unknown error"}`
    );
  }

  return created.id as string;
}
