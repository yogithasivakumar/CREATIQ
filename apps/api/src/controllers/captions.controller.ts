import type { NextFunction, Request, Response } from "express";
import { getOrCreateDefaultWorkspace } from "../services/workspace.service.js";
import { getAsset } from "../services/assets.service.js";
import { generateCaption } from "../services/captions/captionGenerator.js";
import type { GenerateCaptionRequest } from "../validation/caption.schema.js";

export async function postGenerateCaption(
  req: Request<unknown, unknown, GenerateCaptionRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const asset = await getAsset(workspaceId, req.body.assetId);

    const result = generateCaption({
      subject: asset.prompt ?? "this creative",
      style: req.body.style,
      tone: req.body.tone,
      length: req.body.length,
      instructions: req.body.instructions,
      hashtagCount: req.body.hashtagCount,
      variant: req.body.variant,
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}
