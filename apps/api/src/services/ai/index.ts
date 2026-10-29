import { loadEnv } from "../../config/env.js";
import { CloudflareWorkersAiProvider } from "./cloudflareWorkersAi.provider.js";
import { NotConfiguredImageGenerationProvider } from "./notConfigured.provider.js";
import type { ImageGenerationProvider } from "./provider.js";
import { StubImageGenerationProvider } from "./stub.provider.js";

export type {
  ImageGenerationErrorKind,
  ImageGenerationProvider,
} from "./provider.js";
export { ImageGenerationError } from "./provider.js";

let provider: ImageGenerationProvider | undefined;

export function getImageGenerationProvider(): ImageGenerationProvider {
  if (provider) {
    return provider;
  }

  const env = loadEnv();

  if (env.AI_PROVIDER === "stub") {
    provider = new StubImageGenerationProvider();
    return provider;
  }

  // env.AI_PROVIDER === "cloudflare"
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    provider = new CloudflareWorkersAiProvider({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
    });
  } else {
    provider = new NotConfiguredImageGenerationProvider();
  }

  return provider;
}

// Test-only: clears the cached provider so tests can re-select based
// on a changed environment.
export function resetImageGenerationProviderForTests(): void {
  provider = undefined;
}
