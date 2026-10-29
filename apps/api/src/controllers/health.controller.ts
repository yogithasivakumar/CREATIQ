import type { Request, Response } from "express";
import { checkSupabaseConnection } from "../services/supabase.service.js";

export function getHealth(_req: Request, res: Response): void {
  res.json({ ok: true, service: "creatiq-api" });
}

export async function getSupabaseHealth(
  _req: Request,
  res: Response
): Promise<void> {
  const result = await checkSupabaseConnection();

  res.status(result.ok ? 200 : 502).json({
    ok: result.ok,
    service: "supabase",
    message: result.message,
  });
}
