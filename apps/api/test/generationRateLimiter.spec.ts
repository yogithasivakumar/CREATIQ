import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_CONCURRENT_GENERATIONS_PER_USER,
  MAX_GENERATIONS_PER_DAY,
  MAX_REQUESTS_PER_WINDOW,
  checkRateLimit,
  recordGenerationEnd,
  recordGenerationStart,
  resetRateLimiterForTests,
} from "../src/services/generationRateLimiter.js";

describe("generationRateLimiter", () => {
  beforeEach(() => {
    resetRateLimiterForTests();
  });

  it("allows requests under every limit", () => {
    expect(checkRateLimit("user-1")).toEqual({ allowed: true });
  });

  it("blocks after MAX_REQUESTS_PER_WINDOW requests in the window", () => {
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      expect(checkRateLimit("user-1").allowed).toBe(true);
      recordGenerationStart("user-1");
      recordGenerationEnd("user-1");
    }

    expect(checkRateLimit("user-1")).toEqual({
      allowed: false,
      reason: "rate_limited",
    });
  });

  it("blocks a second concurrent generation for the same user", () => {
    expect(checkRateLimit("user-1").allowed).toBe(true);
    recordGenerationStart("user-1");

    expect(checkRateLimit("user-1")).toEqual({
      allowed: false,
      reason: "concurrent_limit",
    });

    recordGenerationEnd("user-1");
    expect(checkRateLimit("user-1").allowed).toBe(true);
  });

  it("does not block a different user while one user is at their concurrent limit", () => {
    recordGenerationStart("user-1");

    expect(checkRateLimit("user-2")).toEqual({ allowed: true });
  });

  it("blocks after MAX_GENERATIONS_PER_DAY generations", () => {
    for (let i = 0; i < MAX_GENERATIONS_PER_DAY; i++) {
      recordGenerationStart("user-1");
      recordGenerationEnd("user-1");
    }

    expect(checkRateLimit("user-1")).toEqual({
      allowed: false,
      reason: "daily_limit",
    });
  });

  it("respects the documented concurrency limit of 1", () => {
    expect(MAX_CONCURRENT_GENERATIONS_PER_USER).toBe(1);
  });
});
