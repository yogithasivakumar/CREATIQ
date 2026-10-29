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
    // Authorization is required here: /api/generate is behind
    // requireAuth (see middleware/auth.ts) and every browser request
    // to it sends a Bearer token. Without Authorization in this list,
    // the preflight response omits it from Access-Control-Allow-Headers,
    // and the browser then blocks the real POST client-side even
    // though the preflight itself returns 204 — curl and other
    // non-browser clients don't enforce this, so the failure is only
    // visible in an actual browser.
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  });
}
