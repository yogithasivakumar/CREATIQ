export type InstagramErrorKind =
  | "not_configured"
  | "not_connected"
  | "token_expired"
  | "invalid_media"
  | "rate_limited"
  | "provider_error";

// Mirrors ImageGenerationError's shape (src/services/ai/provider.ts) —
// a typed, classified error the controller/errorHandler can map to a
// specific HTTP status and a safe, non-leaking message.
export class InstagramError extends Error {
  readonly kind: InstagramErrorKind;
  readonly cause?: unknown;

  constructor(message: string, kind: InstagramErrorKind, cause?: unknown) {
    super(message);
    this.name = "InstagramError";
    this.kind = kind;
    this.cause = cause;
  }
}
