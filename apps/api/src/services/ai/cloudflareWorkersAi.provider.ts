import {
  ImageGenerationError,
  type ImageGenerationProvider,
  type ImageGenerationRequest,
  type ImageGenerationResult,
} from "./provider.js";

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

interface CloudflareWorkersAiConfig {
  accountId: string;
  apiToken: string;
}

// Calls Cloudflare Workers AI over its plain REST API (no Worker
// runtime/binding required). This is a METERED, PAID Cloudflare
// product — see apps/api/src/services/ai/README.md for current
// pricing before enabling it. Only constructed when
// CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are both set.
export class CloudflareWorkersAiProvider implements ImageGenerationProvider {
  readonly name = "cloudflare-workers-ai";

  constructor(private readonly config: CloudflareWorkersAiConfig) {}

  async generateImage(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/ai/run/${MODEL}`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: request.prompt, steps: 4 }),
      });
    } catch (error) {
      throw new ImageGenerationError(
        "Could not reach Cloudflare Workers AI",
        error
      );
    }

    if (!response.ok) {
      throw new ImageGenerationError(
        `Cloudflare Workers AI request failed with status ${response.status}`
      );
    }

    const payload = (await response.json()) as {
      result?: { image?: string };
      success?: boolean;
    };

    if (!payload.success || typeof payload.result?.image !== "string") {
      throw new ImageGenerationError(
        "Cloudflare Workers AI returned an unexpected response"
      );
    }

    return {
      contentType: "image/jpeg",
      image: payload.result.image,
    };
  }
}
