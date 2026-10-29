import { Router } from "express";
import {
  deleteProjectHandler,
  getProjects,
  patchProject,
  postProject,
} from "../controllers/projects.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createProjectSchema, updateProjectSchema } from "../validation/project.schema.js";

export const projectsRouter = Router();

projectsRouter.get("/api/projects", requireAuth, getProjects);
projectsRouter.post("/api/projects", requireAuth, validateBody(createProjectSchema), postProject);
projectsRouter.patch(
  "/api/projects/:id",
  requireAuth,
  validateBody(updateProjectSchema),
  patchProject
);
projectsRouter.delete("/api/projects/:id", requireAuth, deleteProjectHandler);
