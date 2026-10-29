import express, { type Express } from "express";
import { buildCorsMiddleware } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { generateRouter } from "./routes/generate.routes.js";
import { healthRouter } from "./routes/health.routes.js";

export function createApp(): Express {
  const app = express();

  app.use(buildCorsMiddleware());
  app.use(express.json());

  app.use(healthRouter);
  app.use(generateRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
