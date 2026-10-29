import { Router } from "express";
import {
  deleteAssetHandler,
  getAssetById,
  getAssets,
  postAsset,
} from "../controllers/assets.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { listAssetsQuerySchema, saveAssetSchema } from "../validation/asset.schema.js";

export const assetsRouter = Router();

assetsRouter.get("/api/assets", requireAuth, validateQuery(listAssetsQuerySchema), getAssets);
assetsRouter.post("/api/assets", requireAuth, validateBody(saveAssetSchema), postAsset);
assetsRouter.get("/api/assets/:id", requireAuth, getAssetById);
assetsRouter.delete("/api/assets/:id", requireAuth, deleteAssetHandler);
