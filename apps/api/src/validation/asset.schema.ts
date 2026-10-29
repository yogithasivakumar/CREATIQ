import { z } from "zod";

export const listAssetsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  search: z.string().trim().max(500).optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;

// Base64-encoded image data, as already returned by /api/generate. The
// backend decodes and validates it (see imageValidation.ts) before
// uploading — this is not a raw multipart file upload, so no new
// upload middleware/dependency is needed. Only JPEG is accepted since
// that's the only format the generation pipeline currently produces
// (see src/services/ai/README.md).
export const saveAssetSchema = z.object({
  image: z.string().min(1, "Image data is required"),
  prompt: z.string().trim().max(1000).optional(),
  projectId: z.string().uuid().optional(),
});

export type SaveAssetRequest = z.infer<typeof saveAssetSchema>;
