import { describe, expect, it } from "bun:test";
import { app } from "@/app";

type HealthBody = {
  data: { status: string; service: string; version: string; uptime: number };
  error?: unknown;
};

describe("GET /healthz", () => {
  it("returns 200", async () => {
    const response = await app.handle(new Request("http://localhost/healthz"));
    expect(response.status).toBe(200);
  });

  it("reports status, service name and version", async () => {
    const response = await app.handle(new Request("http://localhost/healthz"));
    const body = (await response.json()) as HealthBody;

    expect(body.data.status).toBe("ok");
    expect(body.data.service).toBe("iadm-backend");
    expect(body.data.version).toBeDefined();
    expect(body.data.uptime).toBeGreaterThanOrEqual(0);
  });

  it("wraps the payload in the standard data envelope", async () => {
    const response = await app.handle(new Request("http://localhost/healthz"));
    const body = (await response.json()) as HealthBody;
    expect(body).toHaveProperty("data");
    expect(body).not.toHaveProperty("error");
  });
});
