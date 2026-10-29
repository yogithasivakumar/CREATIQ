import type { NextFunction, Request, Response } from "express";
import { getImageGenerationProvider } from "../services/ai/index.js";
import type { GenerateRequest } from "../validation/generate.schema.js";

export async function postGenerate(
  req: Request<unknown, unknown, GenerateRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const provider = getImageGenerationProvider();
    const result = await provider.generateImage({
      prompt: req.body.prompt,
    });

    res.json({
      ok: true,
      contentType: result.contentType,
      image: result.image,
    });
  } catch (error) {
    next(error);
  }
}
