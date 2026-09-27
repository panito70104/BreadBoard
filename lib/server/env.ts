/**
 * Server environment, validated once at startup.
 *
 * A missing or malformed variable should fail loudly with its name, not show
 * up later as `undefined` inside a database URL or a signing key.
 */

import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),

  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET debe tener al menos 32 caracteres."),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_DOCUMENTS: z.string().default("documents"),
  S3_BUCKET_VIDEOS: z.string().default("videos"),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),

  ANTHROPIC_API_KEY: z.string().optional().transform((value) => value || undefined),
  STORYBOARD_PROVIDER: z.enum(["auto", "claude", "mock"]).default("auto"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Configuración del servidor incompleta. Revisa .env.local:\n${problems}`,
    );
  }

  cached = parsed.data;
  return cached;
}
