import { Router } from "express";
import { getSettings, patchSettings } from "../controllers/settings.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { updateSettingsSchema } from "../validation/settings.schema.js";

export const settingsRouter = Router();

settingsRouter.get("/api/settings", requireAuth, getSettings);
settingsRouter.patch(
  "/api/settings",
  requireAuth,
  validateBody(updateSettingsSchema),
  patchSettings
);
