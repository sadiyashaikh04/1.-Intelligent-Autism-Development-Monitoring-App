import type { AnyElysia } from "elysia";
import { healthRoutes } from "@/routes/health.routes";

/**
 * Mounts every route group with its path prefix. Each new domain in later
 * phases adds exactly one line here.
 *
 * Generic so the caller's derived context (requestId, and later the
 * authenticated user) survives into the returned type.
 */
export function setupRoutes<const App extends AnyElysia>(app: App) {
  return app.group("/healthz", (group) => group.use(healthRoutes));
}
