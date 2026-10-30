// TEMPORARY diagnostic for a live Instagram-connection failure where
// Meta Business Suite shows Full Access but discovery still fails.
// Opt-in only (INSTAGRAM_OAUTH_DEBUG=1) — writes the raw /me/accounts,
// /me/permissions, and (if a target Page ID is set) that Page's detail
// response to a local file, with every access_token value redacted
// before anything touches disk. Safe to delete once the live issue is
// diagnosed; it does nothing unless explicitly enabled.

import { appendFileSync } from "node:fs";
import { loadEnv } from "../../config/env.js";

const DEBUG_FILE = "oauth-debug.local.jsonl";

function redactTokens(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactTokens);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = key.toLowerCase().includes("token") ? "[REDACTED]" : redactTokens(val);
    }
    return out;
  }
  return value;
}

export function isOauthDebugEnabled(): boolean {
  return loadEnv().NODE_ENV !== "production" && process.env.INSTAGRAM_OAUTH_DEBUG === "1";
}

export function recordOauthDebugEvent(label: string, payload: unknown): void {
  if (!isOauthDebugEnabled()) return;

  const entry = {
    at: new Date().toISOString(),
    label,
    payload: redactTokens(payload),
  };

  try {
    appendFileSync(DEBUG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Diagnostics must never break the real flow.
  }
}
