import { describe, expect, it } from "bun:test";
import { app } from "@/app";

type ErrorBody = { error: { code: string; message: string }; data?: unknown };

describe("request id", () => {
  it("returns an x-request-id header on every response", async () => {
    const response = await app.handle(new Request("http://localhost/healthz"));
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("echoes a client-supplied x-request-id instead of inventing one", async () => {
    const response = await app.handle(
      new Request("http://localhost/healthz", {
        headers: { "x-request-id": "client-supplied-id" },
      }),
    );
    expect(response.headers.get("x-request-id")).toBe("client-supplied-id");
  });

  it("issues a different id per request when none is supplied", async () => {
    const first = await app.handle(new Request("http://localhost/healthz"));
    const second = await app.handle(new Request("http://localhost/healthz"));
    expect(first.headers.get("x-request-id")).not.toBe(
      second.headers.get("x-request-id"),
    );
  });
});

describe("security headers", () => {
  it("sets the baseline hardening headers", async () => {
    const response = await app.handle(new Request("http://localhost/healthz"));
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});

describe("error handling", () => {
  it("returns the standard error envelope for an unknown route", async () => {
    const response = await app.handle(
      new Request("http://localhost/no-such-route"),
    );
    expect(response.status).toBe(404);

    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBeDefined();
    expect(body).not.toHaveProperty("data");
  });
});

describe("swagger", () => {
  it("serves the openapi document", async () => {
    const response = await app.handle(
      new Request("http://localhost/swagger/json"),
    );
    expect(response.status).toBe(200);
  });
});
