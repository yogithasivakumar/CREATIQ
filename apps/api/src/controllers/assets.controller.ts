import type { NextFunction, Request, Response } from "express";
import { getOrCreateDefaultWorkspace } from "../services/workspace.service.js";
import {
  deleteAsset,
  getAsset,
  listAssets,
  saveGeneratedAsset,
  updateAssetProject,
} from "../services/assets.service.js";
import type {
  ListAssetsQuery,
  SaveAssetRequest,
  UpdateAssetProjectRequest,
} from "../validation/asset.schema.js";

export async function getAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const query = req.validatedQuery as ListAssetsQuery;
    const result = await listAssets(workspaceId, query);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getAssetById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const asset = await getAsset(workspaceId, req.params.id);
    res.json({ ok: true, asset });
  } catch (error) {
    next(error);
  }
}

export async function postAsset(
  req: Request<unknown, unknown, SaveAssetRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const asset = await saveGeneratedAsset(workspaceId, req.user!.id, req.body);
    res.status(201).json({ ok: true, asset });
  } catch (error) {
    next(error);
  }
}

export async function patchAssetProject(
  req: Request<{ id: string }, unknown, UpdateAssetProjectRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const asset = await updateAssetProject(workspaceId, req.params.id, req.body);
    res.json({ ok: true, asset });
  } catch (error) {
    next(error);
  }
}

export async function deleteAssetHandler(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    await deleteAsset(workspaceId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
