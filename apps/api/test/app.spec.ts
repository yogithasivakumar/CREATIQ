import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/services/supabase.service.js", () => ({
  checkSupabaseConnection: vi.fn().mockResolvedValue({
    ok: true,
    message: "Supabase Storage connected",
  }),
}));

const { createApp } = await import("../src/app.js");

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
  it("rejects an empty prompt with a validation error", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .send({ prompt: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  it("rejects a missing prompt field", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .send({});

    expect(response.status).toBe(400);
  });

  it("returns a generated image for a valid prompt (stub provider)", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .send({ prompt: "a red bicycle" });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(typeof response.body.image).toBe("string");
    expect(response.body.contentType).toBe("image/png");
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
});

describe("Unknown routes", () => {
  it("returns 404", async () => {
    const response = await request(createApp()).get("/does-not-exist");

    expect(response.status).toBe(404);
  });
});
