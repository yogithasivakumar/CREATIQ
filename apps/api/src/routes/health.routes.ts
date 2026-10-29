import { Router } from "express";
import { getHealth, getSupabaseHealth } from "../controllers/health.controller.js";

export const healthRouter = Router();

healthRouter.get("/health", getHealth);
healthRouter.get("/health/supabase", getSupabaseHealth);
