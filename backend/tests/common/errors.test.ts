import { describe, expect, it } from "bun:test";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  UnauthorizedError,
  UpstreamUnavailableError,
  ValidationError,
  toErrorResponse,
} from "@/common/errors";

describe("AppError subclasses", () => {
  it("maps each subclass to its documented status and default code", () => {
    expect(new ValidationError("bad").status).toBe(400);
    expect(new ValidationError("bad").code).toBe("VALIDATION_FAILED");

    expect(new UnauthorizedError("nope").status).toBe(401);
    expect(new UnauthorizedError("nope").code).toBe("UNAUTHORIZED");

    expect(new ForbiddenError("nope").status).toBe(403);
    expect(new ForbiddenError("nope").code).toBe("FORBIDDEN");

    expect(new NotFoundError("gone").status).toBe(404);
    expect(new NotFoundError("gone").code).toBe("NOT_FOUND");

    expect(new ConflictError("dupe").status).toBe(409);
    expect(new ConflictError("dupe").code).toBe("CONFLICT");

    expect(new UpstreamUnavailableError("down").status).toBe(503);
    expect(new UpstreamUnavailableError("down").code).toBe(
      "UPSTREAM_UNAVAILABLE",
    );
  });

  it("accepts a caller-supplied code overriding the default", () => {
    const error = new NotFoundError("no resident", "RESIDENT_NOT_FOUND");
    expect(error.code).toBe("RESIDENT_NOT_FOUND");
    expect(error.status).toBe(404);
  });

  it("is an instance of both its own class and AppError and Error", () => {
    const error = new ConflictError("dupe");
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it("keeps the subclass name for stack traces", () => {
    expect(new ForbiddenError("x").name).toBe("ForbiddenError");
  });
});

describe("InvalidTransitionError", () => {
  it("is 422 with a message naming both states and the entity", () => {
    const error = new InvalidTransitionError("IMPORTED", "ACTIVE", "Resident");
    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(error.message).toContain("IMPORTED");
    expect(error.message).toContain("ACTIVE");
    expect(error.message).toContain("Resident");
  });
});

describe("toErrorResponse", () => {
  it("passes an AppError through with its status, code and message", () => {
    const result = toErrorResponse(
      new NotFoundError("no resident", "RESIDENT_NOT_FOUND"),
    );
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe("RESIDENT_NOT_FOUND");
    expect(result.body.error.message).toBe("no resident");
  });

  it("includes details when the error carries them", () => {
    const details = [{ field: "email", message: "required" }];
    const result = toErrorResponse(
      new ValidationError("invalid", "VALIDATION_FAILED", details),
    );
    expect(result.body.error.details).toEqual(details);
  });

  it("omits the details key entirely when there are none", () => {
    const result = toErrorResponse(new NotFoundError("gone"));
    expect("details" in result.body.error).toBe(false);
  });

  it("converts an unknown Error to a 500 that leaks nothing", () => {
    const result = toErrorResponse(
      new Error("connection string postgres://user:hunter2@host"),
    );
    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL_ERROR");
    expect(result.body.error.message).toBe("Internal server error");
    expect(JSON.stringify(result.body)).not.toContain("hunter2");
  });

  it("converts a non-Error throwable to the same safe 500", () => {
    const result = toErrorResponse("a bare string");
    expect(result.status).toBe(500);
    expect(result.body.error.message).toBe("Internal server error");
  });
});
