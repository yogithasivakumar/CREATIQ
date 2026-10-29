import { InvalidImageOutputError, validateJpegOutput } from "./imageValidation.js";
import { enhancePrompt } from "./promptEnhancer.js";
import {
  ImageGenerationError,
  type ImageGenerationProvider,
  type ImageGenerationRequest,
  type ImageGenerationResult,
} from "./provider.js";

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

// Verified against Cloudflare's raw input schema
// (https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/schema-input.json,
// additionalProperties:false): the ONLY accepted fields are `prompt`
// (string, 1-2048 chars) and `steps` (integer, max 8, default 4).
// There is no width, height, negative_prompt, guidance, or seed field
// — sending any of those would be rejected or silently ignored, so
// this provider does not send them.
//
// `steps` is this model's only quality/cost lever. Default is 4; max
// is 8. At ~9.6 Neurons/step, 4 steps costs ~38 Neurons/image
// (~260 free images/day) while 8 steps costs ~77 Neurons/image
// (~130 free images/day) for a quality gain Cloudflare's docs do not
// quantify. 4 is kept as the default to preserve the existing free
// daily budget; this is a documented cost/quality tradeoff, not an
// oversight.
const GENERATION_STEPS = 4;

// Cloudflare documents a free daily allocation of 10,000 Neurons; if
// exceeded on the Workers Free plan, requests fail with HTTP 429 and
// error code 3036 rather than being billed. See
// https://developers.cloudflare.com/workers-ai/platform/pricing/
// and https://developers.cloudflare.com/workers-ai/platform/errors
const CLOUDFLARE_ERROR_CODE_DAILY_QUOTA_EXHAUSTED = 3036;
const CLOUDFLARE_ERROR_CODE_OUT_OF_CAPACITY = 3040;

const REQUEST_TIMEOUT_MS = 30_000;

interface CloudflareWorkersAiConfig {
  accountId: string;
  apiToken: string;
}

interface CloudflareApiError {
  code?: number;
  message?: string;
}

interface CloudflareApiResponse {
  success?: boolean;
  errors?: CloudflareApiError[];
  result?: { image?: string };
}

// Calls Cloudflare Workers AI over its plain REST API (no Worker
// runtime/binding required). On the Workers FREE plan this is free up
// to 10,000 Neurons/day; exceeding that fails the request with an
// error rather than billing — see
// https://developers.cloudflare.com/workers-ai/platform/pricing/ for
// current numbers before relying on this in any environment that
// matters, and confirm the Cloudflare account has not been upgraded
// to Workers Paid (which removes the free-tier failure behavior and
// bills overage instead). Only constructed when CLOUDFLARE_ACCOUNT_ID
// and CLOUDFLARE_API_TOKEN are both set. Never retries automatically —
// quota/rate-limit/provider errors are surfaced to the caller as-is.
export class CloudflareWorkersAiProvider implements ImageGenerationProvider {
  readonly name = "cloudflare-workers-ai";

  constructor(private readonly config: CloudflareWorkersAiConfig) {}

  async generateImage(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/ai/run/${MODEL}`;

    let enhanced: ReturnType<typeof enhancePrompt>;

    try {
      enhanced = enhancePrompt(request.prompt);
    } catch (error) {
      throw new ImageGenerationError(
        error instanceof Error ? error.message : "Could not prepare the prompt for generation.",
        "provider_error",
        error
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: enhanced.text,
          steps: GENERATION_STEPS,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ImageGenerationError(
          "Image generation timed out. Please try again.",
          "provider_error",
          error
        );
      }

      throw new ImageGenerationError(
        "Could not reach Cloudflare Workers AI.",
        "provider_error",
        error
      );
    } finally {
      clearTimeout(timeout);
    }

    let payload: CloudflareApiResponse;

    try {
      payload = (await response.json()) as CloudflareApiResponse;
    } catch (error) {
      throw new ImageGenerationError(
        "Cloudflare Workers AI returned an unreadable response.",
        "provider_error",
        error
      );
    }

    if (!response.ok) {
      const errorCode = payload.errors?.[0]?.code;

      if (
        response.status === 429 &&
        errorCode === CLOUDFLARE_ERROR_CODE_DAILY_QUOTA_EXHAUSTED
      ) {
        throw new ImageGenerationError(
          "The free daily image-generation quota has been used up. Please try again tomorrow.",
          "quota_exhausted"
        );
      }

      if (
        response.status === 429 &&
        errorCode === CLOUDFLARE_ERROR_CODE_OUT_OF_CAPACITY
      ) {
        throw new ImageGenerationError(
          "The image-generation service is busy right now. Please try again in a moment.",
          "rate_limited"
        );
      }

      if (response.status === 429) {
        throw new ImageGenerationError(
          "Too many image-generation requests. Please slow down and try again.",
          "rate_limited"
        );
      }

      throw new ImageGenerationError(
        `Cloudflare Workers AI request failed with status ${response.status}.`,
        "provider_error"
      );
    }

    if (!payload.success || typeof payload.result?.image !== "string") {
      throw new ImageGenerationError(
        "Cloudflare Workers AI returned an unexpected response.",
        "provider_error"
      );
    }

    // Technical validation only: confirms the payload decodes to a
    // structurally real, non-empty JPEG with readable dimensions. It
    // cannot and does not verify that the image actually matches the
    // prompt — that is a visual-adherence question no automated
    // check here can answer.
    try {
      validateJpegOutput(payload.result.image);
    } catch (error) {
      if (error instanceof InvalidImageOutputError) {
        throw new ImageGenerationError(
          "The image-generation service returned invalid image data. Please try again.",
          "invalid_output",
          error
        );
      }

      throw error;
    }

    return {
      contentType: "image/jpeg",
      image: payload.result.image,
    };
  }
}
