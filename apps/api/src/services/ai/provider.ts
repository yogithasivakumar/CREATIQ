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

export class ImageGenerationError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "ImageGenerationError";
  }
}
