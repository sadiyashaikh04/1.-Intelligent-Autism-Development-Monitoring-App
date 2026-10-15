// Prisma 7 config. Bun auto-loads env files, so no dotenv is needed.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun run --env-file=env/.env.local prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://iadm:iadm_dev_password@localhost:5432/iadm?schema=public",
  },
});
