import { z } from "zod";

export const generateCaptionSchema = z.object({
  assetId: z.string().uuid(),
  style: z.enum([
    "product_highlight",
    "storytelling",
    "promotional",
    "lifestyle",
    "educational",
  ]),
  tone: z.enum(["engaging_friendly", "professional", "playful", "luxurious", "minimal"]),
  length: z.enum(["short", "medium", "long"]),
  instructions: z.string().trim().max(300, "Instructions are too long").optional(),
  hashtagCount: z.coerce.number().int().min(0).max(30).default(5),
  // Bumped by the frontend's "Regenerate" button to get a different
  // deterministic phrasing variant for the same inputs — see
  // captionGenerator.ts for why this isn't randomness.
  variant: z.coerce.number().int().min(0).max(1000).default(0),
});

export type GenerateCaptionRequest = z.infer<typeof generateCaptionSchema>;
