import pino from "pino";
import { config } from "@/config/configs";

const isPretty = config.log.format === "pretty";

/**
 * Anything matching these paths is replaced before it reaches a sink.
 * Secrets must never be recoverable from a log file. Exported so the
 * test suite can assert the coverage rather than trust it.
 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.refreshToken",
  "*.accessToken",
  "*.jwt",
  "*.secret",
] as const;

export const logger = pino({
  level: config.log.level,
  base: {
    service: config.service.name,
    version: config.service.version,
  },
  redact: {
    paths: [...REDACT_PATHS],
    censor: "[REDACTED]",
  },
  transport: isPretty
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss.l" },
      }
    : undefined,
});

/**
 * A child logger bound to one request. Every line it emits carries the
 * same `requestId`, so a single request's logs can be isolated.
 */
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
