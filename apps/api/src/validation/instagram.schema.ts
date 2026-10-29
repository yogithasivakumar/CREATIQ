import { z } from "zod";

export const publishPostSchema = z.object({
  assetId: z.string().uuid(),
  caption: z.string().trim().min(1, "A caption is required").max(2200, "Caption is too long"),
});

export type PublishPostRequest = z.infer<typeof publishPostSchema>;

export const schedulePostSchema = z.object({
  assetId: z.string().uuid(),
  caption: z.string().trim().min(1, "A caption is required").max(2200, "Caption is too long"),
  hashtags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  scheduledFor: z.string().datetime({ message: "scheduledFor must be an ISO 8601 timestamp" }),
});

export type SchedulePostRequest = z.infer<typeof schedulePostSchema>;
