import type { User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      validatedQuery?: unknown;
    }
  }
}

export {};
