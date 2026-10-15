import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { config } from "@/config/configs";
import { logger } from "@/common/logger";
import { LOGGER_EVENTS } from "@/common/loggerEvents";
import { AppError, toErrorResponse } from "@/common/errors";
import { setupRoutes } from "@/routes";

const baseApp = new Elysia()
  // Every request gets an id: the client's if supplied, otherwise a fresh
  // one. It goes into the response header and every log line, so a report
  // of "request X failed" is traceable end to end.
  .derive(({ request }) => ({
    requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
  }))

  .onRequest(({ set }) => {
    set.headers["x-content-type-options"] = "nosniff";
    set.headers["x-frame-options"] = "DENY";
    set.headers["referrer-policy"] = "no-referrer";
    set.headers["permissions-policy"] =
      "camera=(), microphone=(), geolocation=()";
    set.headers["cache-control"] = "no-store, private";
  })

  .onAfterHandle(({ set, requestId }) => {
    set.headers["x-request-id"] = requestId;
  })

  .onError(({ error, code, set, request }) => {
    // Read the id from the request rather than the derived context:
    // an error thrown before or during derive would leave it undefined.
    const requestId =
      request.headers.get("x-request-id") ?? crypto.randomUUID();

    // Elysia's own NOT_FOUND / VALIDATION codes arrive here too, so they
    // are normalised into the same envelope as our AppErrors.
    if (code === "NOT_FOUND") {
      set.status = 404;
      set.headers["x-request-id"] = requestId;
      return {
        error: { code: "NOT_FOUND", message: "Route not found" },
      };
    }

    const { status, body } = toErrorResponse(error);
    set.status = status;
    set.headers["x-request-id"] = requestId;

    const logPayload = {
      event: LOGGER_EVENTS.REQUEST_FAILED,
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      status,
      code: body.error.code,
    };

    if (error instanceof AppError) {
      // Deliberate errors are expected control flow — no stack needed.
      logger.warn(logPayload, body.error.message);
    } else {
      // Unexpected errors are bugs. Log the real message and stack here,
      // where it goes to our logs, never to the client.
      logger.error({ ...logPayload, err: error }, "unhandled error");
    }

    return body;
  })

  .use(
    cors({
      origin: config.cors.origin === "*" ? true : config.cors.origin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Request-ID",
        "Accept",
        "Origin",
      ],
      exposeHeaders: ["X-Request-ID"],
      maxAge: 86400,
    }),
  )

  // No API docs in production — the surface is enumerated for anyone who
  // can reach it.
  .use(
    config.isProduction
      ? new Elysia()
      : swagger({
          path: "/swagger",
          documentation: {
            info: {
              title: config.service.name,
              version: config.service.version,
              description:
                "Intelligent Autism Development Monitoring App — API",
            },
          },
        }),
  );

export const app = setupRoutes(baseApp);
