import type { NextFunction, Request, Response } from "express";
import { getImageGenerationProvider } from "../services/ai/index.js";
import {
  checkRateLimit,
  recordGenerationEnd,
  recordGenerationStart,
} from "../services/generationRateLimiter.js";
import type { GenerateRequest } from "../validation/generate.schema.js";

const RATE_LIMIT_MESSAGES: Record<string, string> = {
  rate_limited:
    "You're generating images too quickly. Please wait a moment and try again.",
  concurrent_limit:
    "You already have an image generating. Please wait for it to finish.",
  daily_limit:
    "You've reached today's image-generation limit. Please try again tomorrow.",
};

export async function postGenerate(
  req: Request<unknown, unknown, GenerateRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  // requireAuth runs before this handler and guarantees req.user.
  const userId = req.user!.id;

  const check = checkRateLimit(userId);

  if (!check.allowed) {
    res.status(429).json({ error: RATE_LIMIT_MESSAGES[check.reason] });
    return;
  }

  recordGenerationStart(userId);

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
  } finally {
    recordGenerationEnd(userId);
  }
}
