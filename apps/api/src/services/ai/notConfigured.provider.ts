import {
  ImageGenerationError,
  type ImageGenerationProvider,
  type ImageGenerationRequest,
  type ImageGenerationResult,
} from "./provider.js";

// Used when AI_PROVIDER=cloudflare but CLOUDFLARE_ACCOUNT_ID /
// CLOUDFLARE_API_TOKEN are missing. Fails every request with a clear
// configuration error instead of silently falling back to the stub,
// so a misconfigured production deployment is loud, not quietly wrong.
export class NotConfiguredImageGenerationProvider
  implements ImageGenerationProvider
{
  readonly name = "not-configured";

  async generateImage(
    _request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    throw new ImageGenerationError(
      "Image generation is not configured on this server. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, or set AI_PROVIDER=stub for development.",
      "not_configured"
    );
  }
}
