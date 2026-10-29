import type { NextFunction, Request, Response } from "express";
import { getUserSettings, updateUserSettings } from "../services/settings.service.js";
import type { UpdateSettingsRequest } from "../validation/settings.schema.js";

export async function getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await getUserSettings(req.user!.id);
    res.json({ ok: true, settings });
  } catch (error) {
    next(error);
  }
}

export async function patchSettings(
  req: Request<unknown, unknown, UpdateSettingsRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await updateUserSettings(req.user!.id, req.body);
    res.json({ ok: true, settings });
  } catch (error) {
    next(error);
  }
}
