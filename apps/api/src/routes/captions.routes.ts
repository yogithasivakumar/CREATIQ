import { Router } from "express";
import { postGenerateCaption } from "../controllers/captions.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { generateCaptionSchema } from "../validation/caption.schema.js";

export const captionsRouter = Router();

captionsRouter.post(
  "/api/captions/generate",
  requireAuth,
  validateBody(generateCaptionSchema),
  postGenerateCaption
);
