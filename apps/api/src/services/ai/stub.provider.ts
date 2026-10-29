import type {
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./provider.js";

// 1x1 transparent PNG, used so callers get a well-formed image payload
// with zero cost and no external dependency. This is the default
// provider until a real one is configured (see cloudflareWorkersAi.provider.ts).
const PLACEHOLDER_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export class StubImageGenerationProvider implements ImageGenerationProvider {
  readonly name = "stub";

  async generateImage(
    _request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    return {
      contentType: "image/png",
      image: PLACEHOLDER_PNG_BASE64,
    };
  }
}
