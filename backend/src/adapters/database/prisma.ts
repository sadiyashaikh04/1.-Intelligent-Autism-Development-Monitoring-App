import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "@/config/configs";
import { logger } from "@/common/logger";
import { LOGGER_EVENTS } from "@/common/loggerEvents";

/**
 * The single Prisma client for the process. Repos import this; nothing
 * else in the codebase may import @prisma/client directly.
 *
 * Prisma 7 connects through a driver adapter rather than its own engine,
 * so the connection string goes to PrismaPg, not to the client.
 *
 * Held on globalThis so `bun --watch` reloads reuse one connection pool
 * instead of leaking a new one on every file save.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.database.url }),
    log: ["warn", "error"],
  });

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info(
    { event: LOGGER_EVENTS.DB_DISCONNECTED },
    "database disconnected",
  );
}
