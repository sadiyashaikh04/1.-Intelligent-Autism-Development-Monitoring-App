import { z } from "zod";
import { NodeEnv } from "@/common/config.types";

const envSchema = z.object({
  NODE_ENV: z
    .enum([
      NodeEnv.DEVELOPMENT,
      NodeEnv.STAGING,
      NodeEnv.PRODUCTION,
      NodeEnv.TEST,
    ])
    .default(NodeEnv.DEVELOPMENT),

  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string().default("0.0.0.0"),

  SERVICE_NAME: z.string().default("iadm-backend"),
  SERVICE_VERSION: z.string().default("0.1.0"),

  DATABASE_URL: z
    .string()
    .startsWith("postgresql://", "DATABASE_URL must be a postgresql:// URL"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export type AppConfig = {
  env: NodeEnv;
  isProduction: boolean;
  server: { port: number; host: string };
  service: { name: string; version: string };
  database: { url: string };
  jwt: { secret: string; accessTtl: string; refreshTtl: string };
  log: { level: string; format: "json" | "pretty" };
  cors: { origin: string };
};

/**
 * Takes the environment as an argument rather than reading it directly.
 * That is what makes it testable — the exported singleton below is just
 * buildConfig(Bun.env).
 *
 * Throws on the first call if anything is invalid, so a misconfigured
 * process dies at startup rather than at the first request that happens
 * to need the bad value.
 */
export function buildConfig(
  env: Record<string, string | undefined>,
): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    // Zod collects every failing field, so a developer with three missing
    // variables learns all three on the first run instead of one per run.
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const e = parsed.data;

  return {
    env: e.NODE_ENV,
    isProduction: e.NODE_ENV === NodeEnv.PRODUCTION,
    server: { port: e.PORT, host: e.HOST },
    service: { name: e.SERVICE_NAME, version: e.SERVICE_VERSION },
    database: { url: e.DATABASE_URL },
    jwt: {
      secret: e.JWT_SECRET,
      accessTtl: e.JWT_ACCESS_TTL,
      refreshTtl: e.JWT_REFRESH_TTL,
    },
    log: { level: e.LOG_LEVEL, format: e.LOG_FORMAT },
    cors: { origin: e.CORS_ORIGIN },
  };
}

export const config: AppConfig = buildConfig(Bun.env);
