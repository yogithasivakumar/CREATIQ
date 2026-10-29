import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z
    .string()
    .default("4000")
    .transform((value) => Number(value))
    .pipe(z.number().int().positive()),

  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("creatiq-assets"),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // Optional: enables the real Cloudflare Workers AI REST provider.
  // See src/services/ai/README.md for cost details. Left unset, the
  // backend falls back to a no-cost stub provider.
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCheck apps/api/.env against apps/api/.env.example.`
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
