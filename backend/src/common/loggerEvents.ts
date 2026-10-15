/**
 * Canonical `event` values for structured logs. Always log with one of
 * these rather than an ad-hoc string, so logs stay greppable and
 * aggregatable as the system grows.
 */
export const LOGGER_EVENTS = {
  SERVER_STARTED: "server.started",
  SERVER_STOPPED: "server.stopped",

  REQUEST_RECEIVED: "request.received",
  REQUEST_COMPLETED: "request.completed",
  REQUEST_FAILED: "request.failed",

  DB_CONNECTED: "db.connected",
  DB_DISCONNECTED: "db.disconnected",

  SEED_STARTED: "seed.started",
  SEED_COMPLETED: "seed.completed",

  CONFIG_LOADED: "config.loaded",
} as const;

export type LoggerEvent = (typeof LOGGER_EVENTS)[keyof typeof LOGGER_EVENTS];
