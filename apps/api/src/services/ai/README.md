# Image generation provider

`getImageGenerationProvider()` returns one implementation of
`ImageGenerationProvider` (see `provider.ts`), selected by the
`AI_PROVIDER` environment variable (`stub` by default):

- **Stub (`AI_PROVIDER=stub`, default)** — `stub.provider.ts` returns a
  small deterministic placeholder PNG. No network calls, no external
  account required. This is what tests and CI use.
- **Cloudflare Workers AI (`AI_PROVIDER=cloudflare`)** —
  `cloudflareWorkersAi.provider.ts` calls the
  `@cf/black-forest-labs/flux-1-schnell` model over Cloudflare's plain
  REST API (no Worker runtime needed). Requires:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN` (needs `Workers AI - Read` and
    `Workers AI - Edit` permissions)

  If `AI_PROVIDER=cloudflare` but either variable is missing, every
  `/api/generate` request fails with a clear "not configured" error
  (`notConfigured.provider.ts`) instead of silently using the stub.

## Cost — verified against Cloudflare's own docs

Checked against https://developers.cloudflare.com/workers-ai/platform/pricing/
and https://developers.cloudflare.com/workers-ai/platform/errors
(reviewed when this was written; re-check before relying on it):

- Workers AI gives a **free allocation of 10,000 Neurons per day**,
  available on the Workers **Free** plan — no credit card required for
  that allocation itself.
- `@cf/black-forest-labs/flux-1-schnell` costs **~9.60 Neurons per
  step**. This provider requests 4 steps per image (~38 Neurons/image),
  so the free daily allocation covers roughly **260 images/day**.
- **On the Workers Free plan, exceeding the daily allocation fails the
  request with HTTP 429 (error code 3036, "Account limited") — it does
  not bill you.** Cloudflare's docs: *"If you exceed any one of the
  above limits, further operations will fail with an error."*
  Billing above the free allocation only applies if the account has
  been **upgraded to the Workers Paid plan** ($0.011 / 1,000 Neurons
  above the allowance).
- This provider never upgrades your plan, adds a payment method, or
  retries on quota/rate-limit errors. It only calls the API with the
  credentials you provide.

**Before setting `AI_PROVIDER=cloudflare` in any environment that
matters, confirm in the Cloudflare dashboard (Account Home → Plans)
that the account is on Workers Free with no payment method attached.**
If the account has been upgraded to Workers Paid, exceeding the free
allocation will bill real money instead of failing — this code cannot
detect or prevent that from the API alone.

## Model input schema — verified against Cloudflare's raw schema, not assumed

Fetched directly from
https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/schema-input.json:

```json
{
  "type": "object",
  "properties": {
    "prompt": { "type": "string", "minLength": 1, "maxLength": 2048 },
    "steps": { "type": "integer", "maximum": 8 }
  },
  "required": ["prompt"],
  "additionalProperties": false
}
```

**This is the entire accepted input.** There is no `width`, `height`,
`negative_prompt`, `guidance`, or `seed` field — `additionalProperties`
is `false`, so sending anything else would be rejected or ignored.
Cloudflare's own usage examples pass a `seed` value, but it is not
part of the enforced schema; this provider does not rely on it.
Practical consequences:
- Image dimensions **cannot be requested or controlled** via this API.
- "Negative constraints" cannot be a real parameter for this model —
  they can only be expressed as natural-language exclusion phrasing
  inside the single `prompt` string (see `promptEnhancer.ts`). This is
  a known diffusion-model technique, **not a guarantee** the model
  will honor it.
- `steps` (1–8, default 4) is the only quality/cost lever available.
  This provider uses 4 by default: ~38 Neurons/image (~260 free
  images/day) vs. 8 steps at ~77 Neurons/image (~130 free images/day)
  for a quality gain Cloudflare does not quantify. This is a
  documented tradeoff favoring more free generations over marginally
  higher per-image quality, not an oversight.
- Output is confirmed JPEG (`image/jpeg`) via two independent
  Cloudflare usage examples on the model page — not assumed.

## Prompt enhancement (apps/api/src/services/ai/promptEnhancer.ts)

A pure, deterministic, template-based function — no LLM call, no
network request, no randomness, zero added cost or latency. It
structures the user's raw prompt into explicit sections (subject,
materials/colors, background, lighting, composition, style, quality,
negative constraints) without inventing new subject matter the user
didn't provide. It does not and cannot guarantee the resulting image
matches the prompt, looks "good," or avoids every listed negative
constraint — it only gives the model a clearer, more structured
request than the raw, unstructured text would.

## Output validation (apps/api/src/services/ai/imageValidation.ts)

Before an image is returned to the client, the provider decodes the
base64 payload and checks: it is non-empty, large enough to be a real
image, starts with a valid JPEG SOI marker, ends with a valid JPEG EOI
marker, and has a parseable SOF frame header with positive width and
height. A payload that is `success: true` but contains garbage bytes
(the old code only checked `typeof image === "string"`) is now
rejected as an `invalid_output` error instead of being silently
returned to the frontend. **This is a technical/structural check
only** — it cannot and does not verify that the image's visual content
matches the prompt.

## Server-side safety limits (apps/api/src/services/generationRateLimiter.ts)

In-memory, per-process, per-user limits — not a durable quota system;
resets on restart and does not span multiple backend instances:

- 5 requests per rolling 60-second window
- 1 concurrent generation at a time
- 50 generations per rolling 24-hour window

These exist to protect the server and the free daily Neuron allocation
from a single runaway client, independent of whatever Cloudflare's own
limits are.

## Adding another provider

Implement `ImageGenerationProvider` in a new file under this
directory, wire it into `index.ts`'s selection logic behind its own
`AI_PROVIDER` value, and document its cost model in this file before
enabling it by default anywhere.
