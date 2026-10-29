import { Router } from "express";
import {
  deleteInstagramScheduled,
  getInstagramCallback,
  getInstagramConnectUrl,
  getInstagramScheduled,
  getInstagramStatusHandler,
  postInstagramDisconnect,
  postInstagramPublish,
  postInstagramSchedule,
  postInstagramScheduledPublishNow,
} from "../controllers/instagram.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { publishPostSchema, schedulePostSchema } from "../validation/instagram.schema.js";

export const instagramRouter = Router();

instagramRouter.get("/api/instagram/connect", requireAuth, getInstagramConnectUrl);

// Not behind requireAuth: this is Meta redirecting the user's browser
// back after the OAuth dialog, so there is no Bearer token to check.
// Identity comes from the `state` value minted by the /connect call
// above and matched server-side in completeInstagramConnect.
instagramRouter.get("/api/instagram/callback", getInstagramCallback);

instagramRouter.get("/api/instagram/status", requireAuth, getInstagramStatusHandler);
instagramRouter.post("/api/instagram/disconnect", requireAuth, postInstagramDisconnect);
instagramRouter.post(
  "/api/instagram/publish",
  requireAuth,
  validateBody(publishPostSchema),
  postInstagramPublish
);
instagramRouter.post(
  "/api/instagram/schedule",
  requireAuth,
  validateBody(schedulePostSchema),
  postInstagramSchedule
);
instagramRouter.get("/api/instagram/scheduled", requireAuth, getInstagramScheduled);
instagramRouter.post(
  "/api/instagram/scheduled/:id/publish",
  requireAuth,
  postInstagramScheduledPublishNow
);
instagramRouter.delete("/api/instagram/scheduled/:id", requireAuth, deleteInstagramScheduled);
