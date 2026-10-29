import cors from "cors";
import { loadEnv } from "../config/env.js";

export function buildCorsMiddleware() {
  const env = loadEnv();
  const allowedOrigins = new Set(
    env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  );

  return cors({
    origin(origin, callback) {
      // Allow non-browser requests (no Origin header, e.g. curl/health checks).
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 86400,
  });
}
