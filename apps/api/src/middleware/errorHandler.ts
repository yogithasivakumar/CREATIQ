import type { NextFunction, Request, Response } from "express";
import { ImageGenerationError } from "../services/ai/index.js";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof ImageGenerationError) {
    console.error(`[image-generation] ${err.message}`, err.cause ?? "");
    res.status(502).json({
      error:
        "Image generation failed. Check backend logs and model availability.",
    });
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Request body must be valid JSON" });
    return;
  }

  if (err instanceof Error && err.message === "Not allowed by CORS") {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  console.error("[unhandled-error]", err);
  res.status(500).json({ error: "Internal server error" });
}
