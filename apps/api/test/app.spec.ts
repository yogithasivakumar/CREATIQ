import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimiterForTests } from "../src/services/generationRateLimiter.js";

const VALID_TOKEN = "valid-test-token";
const TOKEN_TO_USER_ID: Record<string, string> = {
  [VALID_TOKEN]: "user-1",
};
const mockGetUser = vi.fn(async (token: string) => {
  const userId = TOKEN_TO_USER_ID[token];

  if (userId) {
    return {
      data: { user: { id: userId, email: `${userId}@example.com` } },
      error: null,
    };
  }

  return { data: { user: null }, error: new Error("Invalid token") };
});

vi.mock("../src/services/supabase.service.js", () => ({
  checkSupabaseConnection: vi.fn().mockResolvedValue({
    ok: true,
    message: "Supabase Storage connected",
  }),
  getSupabaseAdminClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

const { createApp } = await import("../src/app.js");
const aiModule = await import("../src/services/ai/index.js");

beforeEach(() => {
  resetRateLimiterForTests();
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: "creatiq-api" });
  });
});

describe("GET /health/supabase", () => {
  it("returns the mocked connection status", async () => {
    const response = await request(createApp()).get("/health/supabase");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      service: "supabase",
      message: "Supabase Storage connected",
    });
  });
});

describe("POST /api/generate", () => {
  it("rejects a request with no Authorization header", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .send({ prompt: "a red bicycle" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe(
      "Missing or invalid Authorization header"
    );
  });

  it("rejects a request with an invalid bearer token", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .set("Authorization", "Bearer not-a-real-token")
      .send({ prompt: "a red bicycle" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid or expired session");
  });

  it("rejects an empty prompt with a validation error when authenticated", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ prompt: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  it("rejects a missing prompt field when authenticated", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it("returns a generated image for a valid, authenticated prompt (stub provider)", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ prompt: "a red bicycle" });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(typeof response.body.image).toBe("string");
    expect(response.body.contentType).toBe("image/png");
  });

  it("checks auth before validating the body", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .send({});

    expect(response.status).toBe(401);
  });

  it("rate-limits a user after too many requests in a short window", async () => {
    const token = "rate-limit-test-token";
    TOKEN_TO_USER_ID[token] = "rate-limit-user";
    const app = createApp();

    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post("/api/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({ prompt: `prompt ${i}` });

      expect(response.status).toBe(200);
    }

    const limited = await request(app)
      .post("/api/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "one too many" });

    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatch(/too quickly/i);
  });
});

describe("CORS", () => {
  it("allows the configured frontend origin", async () => {
    const response = await request(createApp())
      .get("/health")
      .set("Origin", "http://localhost:3000");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
  });

  it("rejects an unknown origin on a preflight request", async () => {
    const response = await request(createApp())
      .options("/api/generate")
      .set("Origin", "http://evil.example")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects an unknown origin on a normal request with a clean 403", async () => {
    const response = await request(createApp())
      .get("/health")
      .set("Origin", "http://evil.example");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Origin not allowed" });
  });

  // Regression test: the preflight for POST /api/generate must allow
  // the Authorization header. Chrome blocks the real request client
  // side if the preflight's Access-Control-Allow-Headers doesn't
  // include every header the actual request sends — even though the
  // preflight HTTP response itself still comes back 204. This was the
  // root cause of "preflight succeeds, real POST fails CORS in Chrome".
  it("includes Authorization in the preflight's Access-Control-Allow-Headers for /api/generate", async () => {
    const response = await request(createApp())
      .options("/api/generate")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(response.status).toBe(204);
    const allowedHeaders = (
      response.headers["access-control-allow-headers"] ?? ""
    )
      .split(",")
      .map((h: string) => h.trim().toLowerCase());

    expect(allowedHeaders).toContain("authorization");
    expect(allowedHeaders).toContain("content-type");
  });

  it("includes Access-Control-Allow-Origin on a successful authenticated POST", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .set("Origin", "http://localhost:3000")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ prompt: "a red bicycle" });

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
  });

  it("includes Access-Control-Allow-Origin on a 401 (missing/invalid auth) POST response", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .set("Origin", "http://localhost:3000")
      .send({ prompt: "a red bicycle" });

    expect(response.status).toBe(401);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
  });

  it("includes Access-Control-Allow-Origin on a 400 (validation error) POST response", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .set("Origin", "http://localhost:3000")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ prompt: "" });

    expect(response.status).toBe(400);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
  });

  it("includes Access-Control-Allow-Origin on a 429 (rate-limited) POST response", async () => {
    const token = "cors-rate-limit-token";
    TOKEN_TO_USER_ID[token] = "cors-rate-limit-user";
    const app = createApp();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({ prompt: `prompt ${i}` });
    }

    const response = await request(app)
      .post("/api/generate")
      .set("Origin", "http://localhost:3000")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "one too many" });

    expect(response.status).toBe(429);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
  });

  describe("on an AI-provider error", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("includes Access-Control-Allow-Origin on a provider-error POST response", async () => {
      const { ImageGenerationError } = await import(
        "../src/services/ai/provider.js"
      );
      vi.spyOn(aiModule, "getImageGenerationProvider").mockReturnValue({
        name: "mock-failing-provider",
        generateImage: vi.fn().mockRejectedValue(
          new ImageGenerationError(
            "Cloudflare Workers AI request failed with status 500.",
            "provider_error"
          )
        ),
      });

      const token = "cors-provider-error-token";
      TOKEN_TO_USER_ID[token] = "cors-provider-error-user";

      const response = await request(createApp())
        .post("/api/generate")
        .set("Origin", "http://localhost:3000")
        .set("Authorization", `Bearer ${token}`)
        .send({ prompt: "a red bicycle" });

      expect(response.status).toBe(502);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000"
      );
    });

    it("includes Access-Control-Allow-Origin on a not-configured (503) POST response", async () => {
      const { ImageGenerationError } = await import(
        "../src/services/ai/provider.js"
      );
      vi.spyOn(aiModule, "getImageGenerationProvider").mockReturnValue({
        name: "mock-not-configured",
        generateImage: vi.fn().mockRejectedValue(
          new ImageGenerationError(
            "Image generation is not configured on this server.",
            "not_configured"
          )
        ),
      });

      const token = "cors-not-configured-token";
      TOKEN_TO_USER_ID[token] = "cors-not-configured-user";

      const response = await request(createApp())
        .post("/api/generate")
        .set("Origin", "http://localhost:3000")
        .set("Authorization", `Bearer ${token}`)
        .send({ prompt: "a red bicycle" });

      expect(response.status).toBe(503);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000"
      );
    });
  });
});

describe("Unknown routes", () => {
  it("returns 404", async () => {
    const response = await request(createApp()).get("/does-not-exist");

    expect(response.status).toBe(404);
  });
});
