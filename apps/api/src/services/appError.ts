// Shared, typed application error for the projects/assets APIs, kept
// distinct from ImageGenerationError (which is specific to the AI
// provider pipeline). errorHandler.ts maps `status` directly onto the
// HTTP response.
export class AppError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export function notFound(resource: string): AppError {
  return new AppError(404, `${resource} not found`);
}

export function forbidden(message = "You do not have access to this resource"): AppError {
  return new AppError(403, message);
}
