export interface ImageGenerationRequest {
  prompt: string;
}

export interface ImageGenerationResult {
  contentType: string;
  /** Base64-encoded image data. */
  image: string;
}

export interface ImageGenerationProvider {
  readonly name: string;
  generateImage(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResult>;
}

export type ImageGenerationErrorKind =
  | "not_configured"
  | "quota_exhausted"
  | "rate_limited"
  | "provider_error"
  | "invalid_output";

export class ImageGenerationError extends Error {
  readonly kind: ImageGenerationErrorKind;

  constructor(
    message: string,
    kind: ImageGenerationErrorKind = "provider_error",
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "ImageGenerationError";
    this.kind = kind;
  }
}
