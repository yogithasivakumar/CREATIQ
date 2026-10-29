import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().trim().max(2000, "Description is too long").optional(),
});

export type CreateProjectRequest = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long").optional(),
  description: z.string().trim().max(2000, "Description is too long").optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export type UpdateProjectRequest = z.infer<typeof updateProjectSchema>;
