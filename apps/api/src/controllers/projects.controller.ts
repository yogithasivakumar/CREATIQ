import type { NextFunction, Request, Response } from "express";
import { getOrCreateDefaultWorkspace } from "../services/workspace.service.js";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "../services/projects.service.js";
import type { CreateProjectRequest, UpdateProjectRequest } from "../validation/project.schema.js";

export async function getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const projects = await listProjects(workspaceId);
    res.json({ ok: true, projects });
  } catch (error) {
    next(error);
  }
}

export async function postProject(
  req: Request<unknown, unknown, CreateProjectRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const project = await createProject(workspaceId, req.user!.id, req.body);
    res.status(201).json({ ok: true, project });
  } catch (error) {
    next(error);
  }
}

export async function patchProject(
  req: Request<{ id: string }, unknown, UpdateProjectRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    const project = await updateProject(workspaceId, req.params.id, req.body);
    res.json({ ok: true, project });
  } catch (error) {
    next(error);
  }
}

export async function deleteProjectHandler(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const workspaceId = await getOrCreateDefaultWorkspace(req.user!.id);
    await deleteProject(workspaceId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
