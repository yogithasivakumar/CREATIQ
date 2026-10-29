import type { NextFunction, Request, Response } from "express";
import { getSupabaseAdminClient } from "../services/supabase.service.js";

function extractBearerToken(req: Request): string | undefined {
  const header = req.header("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length).trim() || undefined;
}

// Verifies the caller's Supabase access token against Supabase Auth
// and attaches the resolved user to req.user. Rejects the request with
// 401 if the token is missing or invalid — this is the backend's only
// source of truth for "who is calling"; it never trusts a client-sent
// user id.
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  req.user = data.user;
  next();
}
