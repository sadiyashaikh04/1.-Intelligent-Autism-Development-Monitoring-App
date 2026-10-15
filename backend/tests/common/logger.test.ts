import { describe, expect, it } from "bun:test";
import pino from "pino";
import { LOGGER_EVENTS } from "@/common/loggerEvents";
import { REDACT_PATHS, createRequestLogger, logger } from "@/common/logger";

describe("LOGGER_EVENTS", () => {
  it("exposes the events Phase 0 needs", () => {
    expect(LOGGER_EVENTS.SERVER_STARTED).toBe("server.started");
    expect(LOGGER_EVENTS.REQUEST_COMPLETED).toBe("request.completed");
    expect(LOGGER_EVENTS.REQUEST_FAILED).toBe("request.failed");
    expect(LOGGER_EVENTS.SEED_COMPLETED).toBe("seed.completed");
  });

  it("uses dotted lowercase names throughout", () => {
    for (const value of Object.values(LOGGER_EVENTS)) {
      expect(value).toMatch(/^[a-z]+(\.[a-z_]+)+$/);
    }
  });

  it("has no duplicate values", () => {
    const values = Object.values(LOGGER_EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("logger", () => {
  it("exposes the standard pino levels", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("binds the service name and version to every line", () => {
    expect(logger.bindings().service).toBe("iadm-backend");
    expect(logger.bindings().version).toBeDefined();
  });
});

describe("REDACT_PATHS", () => {
  it("covers the credential-bearing request headers", () => {
    expect(REDACT_PATHS).toContain("req.headers.authorization");
    expect(REDACT_PATHS).toContain("req.headers.cookie");
  });

  it("covers password and token fields at any depth", () => {
    expect(REDACT_PATHS).toContain("*.password");
    expect(REDACT_PATHS).toContain("*.passwordHash");
    expect(REDACT_PATHS).toContain("*.token");
    expect(REDACT_PATHS).toContain("*.refreshToken");
    expect(REDACT_PATHS).toContain("*.accessToken");
    expect(REDACT_PATHS).toContain("*.secret");
  });

  it("actually redacts a password when the logger writes", () => {
    // Build a logger with the same redact config but a captured sink, so
    // this asserts behaviour rather than configuration.
    const lines: string[] = [];
    const probe = pino(
      { redact: { paths: [...REDACT_PATHS], censor: "[REDACTED]" } },
      { write: (line: string) => lines.push(line) },
    );

    probe.info({ user: { email: "a@b.com", password: "hunter2" } }, "login");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("[REDACTED]");
    expect(lines[0]).not.toContain("hunter2");
    expect(lines[0]).toContain("a@b.com");
  });
});

describe("createRequestLogger", () => {
  it("stamps the request id on the child logger bindings", () => {
    const child = createRequestLogger("req-abc-123");
    expect(child.bindings().requestId).toBe("req-abc-123");
  });

  it("keeps the parent service binding", () => {
    const child = createRequestLogger("req-abc-123");
    expect(child.bindings().service).toBe(logger.bindings().service);
  });

  it("returns independent children for different request ids", () => {
    expect(createRequestLogger("a").bindings().requestId).toBe("a");
    expect(createRequestLogger("b").bindings().requestId).toBe("b");
  });
});
