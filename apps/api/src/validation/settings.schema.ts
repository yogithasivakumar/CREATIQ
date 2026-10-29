import { z } from "zod";

export const updateSettingsSchema = z.object({
  defaultCaptionStyle: z
    .enum(["product_highlight", "storytelling", "promotional", "lifestyle", "educational"])
    .optional(),
  defaultTone: z
    .enum(["engaging_friendly", "professional", "playful", "luxurious", "minimal"])
    .optional(),
  defaultLength: z.enum(["short", "medium", "long"]).optional(),
  hashtagCount: z.coerce.number().int().min(0).max(30).optional(),
  customHashtags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  publishNowDefault: z.boolean().optional(),
  schedulingTimezone: z.string().trim().min(1).max(100).optional(),
  displayName: z.string().trim().max(120).optional(),
});

export type UpdateSettingsRequest = z.infer<typeof updateSettingsSchema>;
