import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "../config/env.js";

let client: SupabaseClient | undefined;

// Server-only client authenticated with the secret key. This bypasses
// RLS and must never be sent to, or constructed from data reachable
// by, the frontend.
export function getSupabaseAdminClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const env = loadEnv();

  client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}

export async function checkSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const env = loadEnv();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage.getBucket(
      env.SUPABASE_STORAGE_BUCKET
    );

    if (error || !data) {
      return {
        ok: false,
        message: error?.message ?? "Storage bucket not found",
      };
    }

    return { ok: true, message: "Supabase Storage connected" };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Supabase Storage request failed",
    };
  }
}
