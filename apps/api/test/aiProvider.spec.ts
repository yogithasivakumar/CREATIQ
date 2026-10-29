import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvForTests } from "../src/config/env.js";
import {
  getImageGenerationProvider,
  resetImageGenerationProviderForTests,
} from "../src/services/ai/index.js";

const BASE_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_SECRET_KEY: "test-secret-key",
};

function withEnv(overrides: Record<string, string | undefined>) {
  const original = { ...process.env };

  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    process.env = original;
  };
}

describe("getImageGenerationProvider", () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    resetEnvForTests();
    resetImageGenerationProviderForTests();
  });

  afterEach(() => {
    restoreEnv?.();
    resetEnvForTests();
    resetImageGenerationProviderForTests();
  });

  it("defaults to the stub provider when AI_PROVIDER is unset", () => {
    restoreEnv = withEnv({ AI_PROVIDER: undefined });

    const provider = getImageGenerationProvider();

    expect(provider.name).toBe("stub");
  });

  it("uses the stub provider when AI_PROVIDER=stub", () => {
    restoreEnv = withEnv({ AI_PROVIDER: "stub" });

    const provider = getImageGenerationProvider();

    expect(provider.name).toBe("stub");
  });

  it("returns a clear configuration error when AI_PROVIDER=cloudflare but credentials are missing", async () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: undefined,
      CLOUDFLARE_API_TOKEN: undefined,
    });

    const provider = getImageGenerationProvider();

    expect(provider.name).toBe("not-configured");
    await expect(provider.generateImage({ prompt: "a cat" })).rejects.toThrow(
      /not configured/i
    );
  });

  it("selects the real Cloudflare provider when AI_PROVIDER=cloudflare and credentials are present", () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "acct-123",
      CLOUDFLARE_API_TOKEN: "token-123",
    });

    const provider = getImageGenerationProvider();

    expect(provider.name).toBe("cloudflare-workers-ai");
  });
});

describe("CloudflareWorkersAiProvider error classification", () => {
  let restoreEnv: () => void;
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetEnvForTests();
    resetImageGenerationProviderForTests();
  });

  afterEach(() => {
    restoreEnv?.();
    resetEnvForTests();
    resetImageGenerationProviderForTests();
    global.fetch = originalFetch;
  });

  function mockFetchOnce(status: number, body: unknown) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  it("classifies a 429 with code 3036 as quota_exhausted", async () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "acct-123",
      CLOUDFLARE_API_TOKEN: "token-123",
    });
    mockFetchOnce(429, {
      success: false,
      errors: [{ code: 3036, message: "Account limited" }],
    });

    const provider = getImageGenerationProvider();

    await expect(provider.generateImage({ prompt: "a cat" })).rejects.toMatchObject(
      { kind: "quota_exhausted" }
    );
  });

  it("classifies a 429 with code 3040 as rate_limited", async () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "acct-123",
      CLOUDFLARE_API_TOKEN: "token-123",
    });
    mockFetchOnce(429, {
      success: false,
      errors: [{ code: 3040, message: "Out of capacity" }],
    });

    const provider = getImageGenerationProvider();

    await expect(provider.generateImage({ prompt: "a cat" })).rejects.toMatchObject(
      { kind: "rate_limited" }
    );
  });

  it("classifies an unrecognized 429 as rate_limited", async () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "acct-123",
      CLOUDFLARE_API_TOKEN: "token-123",
    });
    mockFetchOnce(429, { success: false, errors: [] });

    const provider = getImageGenerationProvider();

    await expect(provider.generateImage({ prompt: "a cat" })).rejects.toMatchObject(
      { kind: "rate_limited" }
    );
  });

  it("classifies a 500 as provider_error", async () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "acct-123",
      CLOUDFLARE_API_TOKEN: "token-123",
    });
    mockFetchOnce(500, { success: false, errors: [] });

    const provider = getImageGenerationProvider();

    await expect(provider.generateImage({ prompt: "a cat" })).rejects.toMatchObject(
      { kind: "provider_error" }
    );
  });

  it("classifies a successful response with no image as provider_error", async () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "acct-123",
      CLOUDFLARE_API_TOKEN: "token-123",
    });
    mockFetchOnce(200, { success: true, result: {} });

    const provider = getImageGenerationProvider();

    await expect(provider.generateImage({ prompt: "a cat" })).rejects.toMatchObject(
      { kind: "provider_error" }
    );
  });

  it("does not retry on failure (fetch called exactly once)", async () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "acct-123",
      CLOUDFLARE_API_TOKEN: "token-123",
    });
    mockFetchOnce(429, {
      success: false,
      errors: [{ code: 3036, message: "Account limited" }],
    });

    const provider = getImageGenerationProvider();

    await expect(provider.generateImage({ prompt: "a cat" })).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("sends the enhanced (structured) prompt, not the raw user prompt", async () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "acct-123",
      CLOUDFLARE_API_TOKEN: "token-123",
    });

    const jpeg = buildMinimalJpeg(512, 512);
    mockFetchOnce(200, { success: true, result: { image: jpeg.toString("base64") } });

    const provider = getImageGenerationProvider();
    await provider.generateImage({ prompt: "a red bicycle" });

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentBody = JSON.parse(fetchCall[1].body as string);

    expect(sentBody.prompt).not.toBe("a red bicycle");
    expect(sentBody.prompt).toContain("Subject: a red bicycle.");
    expect(sentBody.prompt).toMatch(/do not include any text/i);
    expect(sentBody.steps).toBe(4);
  });

  it("returns the image when the provider's output is a structurally valid JPEG", async () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "acct-123",
      CLOUDFLARE_API_TOKEN: "token-123",
    });

    const jpeg = buildMinimalJpeg(768, 768);
    const base64 = jpeg.toString("base64");
    mockFetchOnce(200, { success: true, result: { image: base64 } });

    const provider = getImageGenerationProvider();
    const result = await provider.generateImage({ prompt: "a cat" });

    expect(result.contentType).toBe("image/jpeg");
    expect(result.image).toBe(base64);
  });

  it("classifies a successful response with invalid/corrupt image bytes as invalid_output", async () => {
    restoreEnv = withEnv({
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "acct-123",
      CLOUDFLARE_API_TOKEN: "token-123",
    });

    // "success: true" with a well-formed envelope, but the image
    // field itself is garbage — this is the case the old code would
    // have silently accepted (it only checked typeof === "string").
    mockFetchOnce(200, {
      success: true,
      result: { image: Buffer.from("not a real jpeg").toString("base64") },
    });

    const provider = getImageGenerationProvider();

    await expect(provider.generateImage({ prompt: "a cat" })).rejects.toMatchObject(
      { kind: "invalid_output" }
    );
  });
});

function buildMinimalJpeg(width: number, height: number): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const sof0 = Buffer.from([
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
  ]);
  const padding = Buffer.alloc(600, 0x00);
  const eoi = Buffer.from([0xff, 0xd9]);

  return Buffer.concat([soi, sof0, padding, eoi]);
}
