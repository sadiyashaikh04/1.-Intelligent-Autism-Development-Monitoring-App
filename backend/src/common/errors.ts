/**
 * Base class for every error this application raises deliberately.
 * Anything that is NOT an AppError is treated as a bug and returned as a
 * generic 500 — see toErrorResponse.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    // new.target.name gives the concrete subclass, so stack traces read
    // "ForbiddenError: ..." rather than "Error: ...".
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
  constructor(message: string, code = "VALIDATION_FAILED", details?: unknown) {
    super(message, code, details);
  }
}

export class UnauthorizedError extends AppError {
  readonly status = 401;
  constructor(message: string, code = "UNAUTHORIZED", details?: unknown) {
    super(message, code, details);
  }
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  constructor(message: string, code = "FORBIDDEN", details?: unknown) {
    super(message, code, details);
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  constructor(message: string, code = "NOT_FOUND", details?: unknown) {
    super(message, code, details);
  }
}

export class ConflictError extends AppError {
  readonly status = 409;
  constructor(message: string, code = "CONFLICT", details?: unknown) {
    super(message, code, details);
  }
}

export class InvalidTransitionError extends AppError {
  readonly status = 422;
  constructor(from: string, to: string, entity: string) {
    super(
      `${entity} cannot move from ${from} to ${to}`,
      "INVALID_STATUS_TRANSITION",
      { from, to, entity },
    );
  }
}

export class UpstreamUnavailableError extends AppError {
  readonly status = 503;
  constructor(
    message: string,
    code = "UPSTREAM_UNAVAILABLE",
    details?: unknown,
  ) {
    super(message, code, details);
  }
}

export type ErrorResponse = {
  status: number;
  body: { error: { code: string; message: string; details?: unknown } };
};

/**
 * Maps any thrown value to the wire format. Deliberate AppErrors keep
 * their message; everything else collapses to a generic 500, because
 * unexpected error messages routinely contain connection strings, file
 * paths and query fragments that must not reach a client.
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    },
  };
}
