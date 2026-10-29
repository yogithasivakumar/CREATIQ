import { Router } from "express";
import { postGenerate } from "../controllers/generate.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { generateRequestSchema } from "../validation/generate.schema.js";

export const generateRouter = Router();

generateRouter.post(
  "/api/generate",
  requireAuth,
  validateBody(generateRequestSchema),
  postGenerate
);
