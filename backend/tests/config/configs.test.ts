import { describe, expect, it } from "bun:test";
import { buildConfig } from "@/config/configs";
import { NodeEnv } from "@/common/config.types";

const validEnv = {
  DATABASE_URL: "postgresql://iadm:pw@localhost:5432/iadm?schema=public",
  JWT_SECRET: "a".repeat(32),
};

describe("buildConfig", () => {
  it("applies documented defaults when optional vars are absent", () => {
    const config = buildConfig(validEnv);

    expect(config.env).toBe(NodeEnv.DEVELOPMENT);
    expect(config.server.port).toBe(5000);
    expect(config.server.host).toBe("0.0.0.0");
    expect(config.service.name).toBe("iadm-backend");
    expect(config.log.level).toBe("info");
    expect(config.isProduction).toBe(false);
  });

  it("coerces PORT from string to number", () => {
    const config = buildConfig({ ...validEnv, PORT: "5001" });
    expect(config.server.port).toBe(5001);
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => buildConfig({ JWT_SECRET: "a".repeat(32) })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("throws when JWT_SECRET is shorter than 32 characters", () => {
    expect(() => buildConfig({ ...validEnv, JWT_SECRET: "too-short" })).toThrow(
      /JWT_SECRET/,
    );
  });

  it("rejects a DATABASE_URL that is not a postgresql:// url", () => {
    expect(() =>
      buildConfig({ ...validEnv, DATABASE_URL: "mysql://localhost/db" }),
    ).toThrow(/DATABASE_URL/);
  });

  it("sets isProduction only for NODE_ENV=production", () => {
    expect(
      buildConfig({ ...validEnv, NODE_ENV: "production" }).isProduction,
    ).toBe(true);
    expect(buildConfig({ ...validEnv, NODE_ENV: "staging" }).isProduction).toBe(
      false,
    );
  });

  it("reports every missing variable at once, not just the first", () => {
    try {
      buildConfig({});
      throw new Error("expected buildConfig to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("DATABASE_URL");
      expect(message).toContain("JWT_SECRET");
    }
  });
});
