// In-memory, per-process request limiter for image generation.
//
// This is intentionally simple: it protects the server (and the free
// Cloudflare Workers AI daily quota) from a single runaway client, not
// a durable, cross-instance usage-tracking system. Counts reset on
// server restart and are not shared across multiple backend
// instances — a future phase would need persistent storage (e.g. a
// Postgres table) for real multi-instance quota enforcement.
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_REQUESTS_PER_WINDOW = 5;
export const MAX_CONCURRENT_GENERATIONS_PER_USER = 1;
export const MAX_GENERATIONS_PER_DAY = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

interface UserUsage {
  requestTimestamps: number[];
  concurrentCount: number;
  dayWindowStart: number;
  dayCount: number;
}

const usageByUser = new Map<string, UserUsage>();

function getUsage(userId: string): UserUsage {
  let usage = usageByUser.get(userId);

  if (!usage) {
    usage = {
      requestTimestamps: [],
      concurrentCount: 0,
      dayWindowStart: Date.now(),
      dayCount: 0,
    };
    usageByUser.set(userId, usage);
  }

  return usage;
}

export type RateLimitCheck =
  | { allowed: true }
  | { allowed: false; reason: "rate_limited" | "concurrent_limit" | "daily_limit" };

// Call before starting a generation. Does not mutate state by itself
// beyond pruning old timestamps — call recordStart()/recordEnd() around
// the actual provider call.
export function checkRateLimit(userId: string): RateLimitCheck {
  const now = Date.now();
  const usage = getUsage(userId);

  if (now - usage.dayWindowStart >= DAY_MS) {
    usage.dayWindowStart = now;
    usage.dayCount = 0;
  }

  usage.requestTimestamps = usage.requestTimestamps.filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (usage.concurrentCount >= MAX_CONCURRENT_GENERATIONS_PER_USER) {
    return { allowed: false, reason: "concurrent_limit" };
  }

  if (usage.dayCount >= MAX_GENERATIONS_PER_DAY) {
    return { allowed: false, reason: "daily_limit" };
  }

  if (usage.requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, reason: "rate_limited" };
  }

  return { allowed: true };
}

export function recordGenerationStart(userId: string): void {
  const usage = getUsage(userId);
  const now = Date.now();

  usage.requestTimestamps.push(now);
  usage.concurrentCount += 1;
  usage.dayCount += 1;
}

export function recordGenerationEnd(userId: string): void {
  const usage = usageByUser.get(userId);

  if (usage) {
    usage.concurrentCount = Math.max(0, usage.concurrentCount - 1);
  }
}

// Test-only: resets all in-memory usage state between test cases.
export function resetRateLimiterForTests(): void {
  usageByUser.clear();
}
