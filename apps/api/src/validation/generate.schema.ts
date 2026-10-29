import { z } from "zod";

export const generateRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Prompt must contain 1-1000 characters")
    .max(1000, "Prompt must contain 1-1000 characters"),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
