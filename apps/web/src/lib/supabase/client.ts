import { createBrowserClient } from "@supabase/ssr";

// Browser-side client. Reads/writes the auth session via cookies so it
// stays in sync with the server client and the middleware.
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase configuration. Check apps/web/.env.local."
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
