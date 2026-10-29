# Image generation provider

`getImageGenerationProvider()` returns one implementation of
`ImageGenerationProvider` (see `provider.ts`), chosen at startup:

- **Stub (default, no cost)** — `stub.provider.ts` returns a small
  placeholder PNG. Used whenever `CLOUDFLARE_ACCOUNT_ID` /
  `CLOUDFLARE_API_TOKEN` are not set. Safe for local development and
  CI; no network calls, no external account required.
- **Cloudflare Workers AI (paid, opt-in)** — `cloudflareWorkersAi.provider.ts`
  calls the `@cf/black-forest-labs/flux-1-schnell` model over
  Cloudflare's plain REST API (no Worker runtime needed). This is a
  **metered, paid Cloudflare product**; check current Workers AI
  pricing at https://developers.cloudflare.com/workers-ai/platform/pricing/
  before enabling it in any environment that matters. Requires:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN` (needs Workers AI permissions)

To add another provider (OpenAI, Replicate, Stability, etc.), implement
`ImageGenerationProvider` in a new file under this directory and wire
it into `index.ts`'s selection logic. Document its cost model here
before enabling it by default anywhere.
