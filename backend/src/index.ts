import { app } from "@/app";
import { config } from "@/config/configs";
import { logger } from "@/common/logger";
import { LOGGER_EVENTS } from "@/common/loggerEvents";
import { disconnectPrisma } from "@/adapters/database/prisma";

app.listen({ port: config.server.port, hostname: config.server.host });

logger.info(
  {
    event: LOGGER_EVENTS.SERVER_STARTED,
    port: config.server.port,
    host: config.server.host,
    env: config.env,
  },
  `${config.service.name} listening on http://${config.server.host}:${config.server.port}`,
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ event: LOGGER_EVENTS.SERVER_STOPPED, signal }, "shutting down");
  await app.stop();
  await disconnectPrisma();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
