import { loadEnv } from "../../config/env.js";
import { CloudflareWorkersAiProvider } from "./cloudflareWorkersAi.provider.js";
import type { ImageGenerationProvider } from "./provider.js";
import { StubImageGenerationProvider } from "./stub.provider.js";

export type { ImageGenerationProvider } from "./provider.js";
export { ImageGenerationError } from "./provider.js";

let provider: ImageGenerationProvider | undefined;

export function getImageGenerationProvider(): ImageGenerationProvider {
  if (provider) {
    return provider;
  }

  const env = loadEnv();

  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    provider = new CloudflareWorkersAiProvider({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
    });
  } else {
    provider = new StubImageGenerationProvider();
  }

  return provider;
}
