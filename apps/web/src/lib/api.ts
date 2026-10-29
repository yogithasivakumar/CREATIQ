import { createClient } from "@/lib/supabase/client";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Shared authenticated fetch for the Express backend. Attaches the
// current Supabase session's access token as a Bearer header — the
// same pattern /dashboard/generate already used inline — so new pages
// (library, projects) don't each reimplement token retrieval and
// error parsing.
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new ApiError(401, "Please sign in to continue.");
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data.error || "Request failed. Please try again.");
  }

  return data as T;
}
