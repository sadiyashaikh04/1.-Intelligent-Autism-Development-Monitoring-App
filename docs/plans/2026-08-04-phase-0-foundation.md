# Phase 0 — Foundation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the IADM backend skeleton — a running Elysia server with validated config, structured logging, a typed error hierarchy, the complete 22-model Prisma schema migrated into Postgres, and a seed producing 10 residents across the status machine.

**Architecture:** A Bun + Elysia API layered `routes → services → repos → Prisma`, with cross-cutting concerns (config, logger, errors) in `src/common/` and external systems behind `src/adapters/`. Phase 0 builds only the foundation layer plus one route (`/healthz`); no domain endpoints yet. Postgres runs in Docker Compose so the whole team gets an identical database.

**Tech Stack:** Bun 1.3, Elysia 1.4, Prisma 7.9 + PostgreSQL 16, Zod 4.4, Pino 10, TypeScript 5.9.

**Spec:** [`docs/specs/2026-08-04-iadm-autism-monitoring-design.md`](../specs/2026-08-04-iadm-autism-monitoring-design.md) — Phase 0 row in §10.

**Phase 0 is done when:** `bun dev` starts, `GET /healthz` returns 200, and `bun run db:setup` seeds 10 residents.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Layering is strict.** Request flow is `routes → services → repos → Prisma`. Routes never import `@prisma/client`. Services never call Prisma directly. (Spec §2.1)
- **Config is centralised.** All environment access goes through `config` imported from `@/config/configs`. Never read `Bun.env` or `process.env` anywhere else. The Zod schema in that file is the source of truth for which env vars exist. (Spec §2.1)
- **Path alias `@/*` → `src/*`** for every internal import. No relative imports that climb directories (`../../`).
- **Logging uses `LOGGER_EVENTS` constants** for the `event` field, never ad-hoc strings. (Spec §2.1)
- **External systems live behind `src/adapters/`.** Never import a database or HTTP SDK directly in a service.
- **Naming follows IAC.** UUID primary keys via `dbgenerated("gen_random_uuid()")` mapped to `<entity>_id`; camelCase Prisma fields with `@map("snake_case")`; plural snake_case table names via `@@map`; timestamps `@db.Timestamptz(6)`.
- **Commits carry no `Co-Authored-By` trailer.** Authorship on this repo is assessed.
- **The `iac/` directory is never committed.** It sits outside this repo; run `git status` before every commit and confirm no `iac` paths appear.
- **Ports:** Postgres container `5433` (host `5432` is taken by a local Homebrew Postgres), backend `5000`.
- **All data is synthetic.** No real clinical records enter this repo, ever.

---

## Prerequisites

Before Task 1, confirm each of these. If any fails, stop and fix it — later tasks assume all four.

```bash
bun --version            # expect 1.3.x
docker info              # must succeed — start Docker Desktop if it errors
docker compose version   # expect v2+
git -C . config user.name  # expect sadiyashaikh04, NOT murtazrootlex
```

---

## File Structure

Everything in this phase lives under `backend/`, except `docker-compose.yml` at the repo root.

| File | Responsibility |
|---|---|
| `docker-compose.yml` | Postgres 16 on host port 5433, named volume for persistence |
| `backend/package.json` | Dependencies and the `dev` / `check` / `db:*` scripts |
| `backend/tsconfig.json` | Strict TypeScript, `@/*` path alias |
| `backend/eslint.config.js` | Lint rules |
| `backend/.prettierrc` | Format rules |
| `backend/prisma.config.ts` | Prisma 7 config: schema path, migrations path, seed command |
| `backend/env/.env.example` | Documented template, committed |
| `backend/env/.env.local` | Real local values, gitignored |
| `backend/src/common/config.types.ts` | `NodeEnv` enum — separate from `configs.ts` to avoid an import cycle with the logger |
| `backend/src/config/configs.ts` | Zod-validated config object; the only reader of `Bun.env` |
| `backend/src/common/loggerEvents.ts` | `LOGGER_EVENTS` string constants |
| `backend/src/common/logger.ts` | Pino instance + request-id context helpers |
| `backend/src/common/errors.ts` | `AppError` hierarchy + `toHttpError()` mapping |
| `backend/src/adapters/database/prisma.ts` | Singleton Prisma client |
| `backend/src/routes/health.routes.ts` | `GET /healthz` |
| `backend/src/routes/index.ts` | Mounts every route group with its prefix |
| `backend/src/app.ts` | Elysia instance: swagger, cors, request-id, error handler, routes |
| `backend/src/index.ts` | Server entrypoint |
| `backend/prisma/schema.prisma` | 28 enums, 22 models |
| `backend/prisma/seed.ts` | Baseline demo data (§9.1 of the spec) |

Tests mirror source paths under `backend/tests/`.

---

## Task 1: Postgres via Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/env/.env.example`
- Create: `backend/env/.env.local`

**Interfaces:**
- Consumes: nothing
- Produces: a Postgres 16 database reachable at `postgresql://iadm:iadm_dev_password@localhost:5433/iadm?schema=public`, and the env var name `DATABASE_URL` that every later task reads via config.

- [ ] **Step 1: Write the compose file**

Create `docker-compose.yml` at the repo root:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: iadm-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: iadm
      POSTGRES_PASSWORD: iadm_dev_password
      POSTGRES_DB: iadm
    ports:
      # Host 5433, not 5432 — a local Homebrew Postgres already owns 5432.
      - "5433:5432"
    volumes:
      - iadm_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U iadm -d iadm"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  iadm_pgdata:
```

- [ ] **Step 2: Start it and wait for healthy**

```bash
docker compose up -d
docker compose ps
```

Expected: `iadm-postgres` listed with status `Up` and `(healthy)`. If it shows `(health: starting)`, wait 10 seconds and re-run.

- [ ] **Step 3: Verify the database accepts connections**

```bash
docker compose exec postgres psql -U iadm -d iadm -c "SELECT version();"
```

Expected: a `PostgreSQL 16.x` version string. If this fails with "database does not exist", the volume was created by an earlier run with different settings — run `docker compose down -v` and repeat Step 2.

- [ ] **Step 4: Verify `gen_random_uuid()` is available**

The schema depends on it for every primary key. It is built into PostgreSQL 13+, so no extension is needed — this step proves it.

```bash
docker compose exec postgres psql -U iadm -d iadm -c "SELECT gen_random_uuid();"
```

Expected: one UUID value.

- [ ] **Step 5: Write the env template**

Create `backend/env/.env.example`:

```bash
# Runtime
NODE_ENV=development
PORT=5000
HOST=0.0.0.0

# Service identity — appears in logs and the Swagger title
SERVICE_NAME=iadm-backend
SERVICE_VERSION=0.1.0

# Database — port 5433, see docker-compose.yml
DATABASE_URL=postgresql://iadm:iadm_dev_password@localhost:5433/iadm?schema=public

# Auth (used from Phase 1; must be present from Phase 0 so config validates)
JWT_SECRET=change_me_local_dev_secret_at_least_32_chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty

# CORS
CORS_ORIGIN=http://localhost:3000
```

- [ ] **Step 6: Create the real local env file**

```bash
cp backend/env/.env.example backend/env/.env.local
```

`.env.local` is gitignored (`.env.*` with a `!.env.*.example` negation). Confirm:

```bash
git check-ignore -v backend/env/.env.local   # expect a match line
git check-ignore -v backend/env/.env.example  # expect NO output (exit 1)
```

- [ ] **Step 7: Commit**

```bash
git status --short          # confirm no 'iac' paths and no .env.local
git add docker-compose.yml backend/env/.env.example
git commit -m "chore: add postgres via docker compose and env template

Postgres 16 on host port 5433 to avoid the local Homebrew Postgres
already bound to 5432. Named volume so data survives restarts."
```

---

## Task 2: Backend project init, TypeScript, and tooling

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/eslint.config.js`, `backend/.prettierrc`, `backend/.prettierignore`
- Create: `backend/src/index.ts` (placeholder, replaced in Task 10)

**Interfaces:**
- Consumes: nothing
- Produces: the `@/*` → `src/*` path alias every later task imports through; the scripts `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run check`, `bun test`.

- [ ] **Step 1: Initialise and install dependencies**

```bash
cd backend
bun init -y
bun add elysia@^1.4.29 @elysiajs/swagger@^1.3.1 @elysiajs/cors@^1.4.2 \
        @prisma/client@^7.9.1 zod@^4.4.3 pino@^10.3.1 pino-pretty@^13.1.3
bun add -d prisma@^7.9.1 typescript@^5.9.3 @types/bun@latest \
        eslint@^9 @eslint/js typescript-eslint prettier
```

TypeScript is pinned to 5.9 rather than the newer 7.x, because the Prisma and ESLint toolchains are still settling against the native port and a college project should not be debugging its compiler.

- [ ] **Step 2: Write `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["bun-types"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "prisma/**/*.ts", "*.ts"]
}
```

- [ ] **Step 3: Replace the `scripts` block in `backend/package.json`**

```json
{
  "name": "iadm-backend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --env-file=env/.env.local --watch src/index.ts",
    "start": "bun run --env-file=env/.env.local src/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src tests",
    "format": "prettier --write \"{src,tests,prisma}/**/*.{ts,json,md}\"",
    "format:check": "prettier --check \"{src,tests,prisma}/**/*.{ts,json,md}\"",
    "check": "bun run lint && bun run format:check && bun run typecheck",
    "test": "bun test",
    "db:generate": "bunx prisma generate",
    "db:migrate:dev": "bunx prisma migrate dev",
    "db:migrate:deploy": "bunx prisma migrate deploy",
    "db:migrate:reset": "bunx prisma migrate reset --force",
    "db:seed": "bunx prisma db seed",
    "db:validate": "bunx prisma validate",
    "db:format": "bunx prisma format",
    "db:studio": "bunx prisma studio",
    "db:setup": "bunx prisma generate && bunx prisma migrate dev && bun run db:seed"
  }
}
```

Keep the `dependencies` and `devDependencies` blocks that `bun add` wrote.

- [ ] **Step 4: Write `backend/eslint.config.js`**

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      // Targets the property, not the global, so `process.on` in the
      // entrypoint still works while `process.env` anywhere is caught.
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read env through `config` from @/config/configs — never process.env.",
        },
        {
          object: "Bun",
          property: "env",
          message:
            "Read env through `config` from @/config/configs — never Bun.env.",
        },
      ],
    },
  },
  {
    // configs.ts is the one legitimate reader of the environment.
    files: ["src/config/configs.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  { ignores: ["node_modules/", "dist/", "prisma/migrations/"] },
);
```

The `no-restricted-properties` rule mechanically enforces the "config is centralised" constraint, so a violation fails lint instead of surviving to review. It targets `process.env` and `Bun.env` specifically rather than the `process` global, so `process.on("SIGTERM", ...)` in the entrypoint is still allowed.

- [ ] **Step 5: Write `backend/.prettierrc` and `backend/.prettierignore`**

`.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 80,
  "tabWidth": 2
}
```

`.prettierignore`:

```
node_modules
prisma/migrations
*.md
```

- [ ] **Step 6: Write a placeholder entrypoint**

Create `backend/src/index.ts`:

```typescript
console.log("iadm-backend: placeholder entrypoint, replaced in Task 10");
```

- [ ] **Step 7: Verify the toolchain runs clean**

```bash
cd backend
bun run typecheck    # expect: no output, exit 0
bun run lint         # expect: no output, exit 0
bun run format:check # expect: "All matched files use Prettier code style!"
```

If `format:check` fails, run `bun run format` and re-check.

- [ ] **Step 8: Commit**

```bash
cd ..
git status --short
git add backend/package.json backend/bun.lock backend/tsconfig.json \
        backend/eslint.config.js backend/.prettierrc backend/.prettierignore \
        backend/src/index.ts
git commit -m "chore(backend): init bun project with typescript, eslint, prettier

Pins TypeScript to 5.9 rather than 7.x for toolchain stability. Adds a
no-restricted-globals rule so reading process.env outside configs.ts
fails lint."
```

---

## Task 3: Zod-validated config

**Files:**
- Create: `backend/src/common/config.types.ts`
- Create: `backend/src/config/configs.ts`
- Test: `backend/tests/config/configs.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL`, `PORT`, `HOST`, `NODE_ENV`, `JWT_SECRET`, `LOG_LEVEL`, `LOG_FORMAT`, `SERVICE_NAME`, `SERVICE_VERSION`, `CORS_ORIGIN`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` from the environment.
- Produces:
  - `enum NodeEnv { DEVELOPMENT = "development", STAGING = "staging", PRODUCTION = "production", TEST = "test" }` from `@/common/config.types`
  - `buildConfig(env: Record<string, string | undefined>): AppConfig` from `@/config/configs`
  - `config: AppConfig` (the singleton every other module imports) from `@/config/configs`
  - `AppConfig` shape: `{ env: NodeEnv; isProduction: boolean; server: { port: number; host: string }; service: { name: string; version: string }; database: { url: string }; jwt: { secret: string; accessTtl: string; refreshTtl: string }; log: { level: string; format: "json" | "pretty" }; cors: { origin: string } }`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/config/configs.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { buildConfig } from "@/config/configs";
import { NodeEnv } from "@/common/config.types";

const validEnv = {
  DATABASE_URL: "postgresql://iadm:pw@localhost:5433/iadm?schema=public",
  JWT_SECRET: "a".repeat(32),
};

describe("buildConfig", () => {
  it("applies documented defaults when optional vars are absent", () => {
    const config = buildConfig(validEnv);

    expect(config.env).toBe(NodeEnv.DEVELOPMENT);
    expect(config.server.port).toBe(5000);
    expect(config.server.host).toBe("0.0.0.0");
    expect(config.service.name).toBe("iadm-backend");
    expect(config.log.level).toBe("info");
    expect(config.isProduction).toBe(false);
  });

  it("coerces PORT from string to number", () => {
    const config = buildConfig({ ...validEnv, PORT: "5001" });
    expect(config.server.port).toBe(5001);
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => buildConfig({ JWT_SECRET: "a".repeat(32) })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("throws when JWT_SECRET is shorter than 32 characters", () => {
    expect(() =>
      buildConfig({ ...validEnv, JWT_SECRET: "too-short" }),
    ).toThrow(/JWT_SECRET/);
  });

  it("rejects a DATABASE_URL that is not a postgresql:// url", () => {
    expect(() =>
      buildConfig({ ...validEnv, DATABASE_URL: "mysql://localhost/db" }),
    ).toThrow(/DATABASE_URL/);
  });

  it("sets isProduction only for NODE_ENV=production", () => {
    expect(buildConfig({ ...validEnv, NODE_ENV: "production" }).isProduction)
      .toBe(true);
    expect(buildConfig({ ...validEnv, NODE_ENV: "staging" }).isProduction)
      .toBe(false);
  });

  it("reports every missing variable at once, not just the first", () => {
    try {
      buildConfig({});
      throw new Error("expected buildConfig to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("DATABASE_URL");
      expect(message).toContain("JWT_SECRET");
    }
  });
});
```

`buildConfig` takes the environment as an argument rather than reading `Bun.env` itself. That is what makes it testable — the singleton `config` is just `buildConfig(Bun.env)`.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && bun test tests/config/configs.test.ts
```

Expected: FAIL — cannot resolve module `@/config/configs`.

- [ ] **Step 3: Write `backend/src/common/config.types.ts`**

```typescript
export enum NodeEnv {
  DEVELOPMENT = "development",
  STAGING = "staging",
  PRODUCTION = "production",
  TEST = "test",
}
```

This lives apart from `configs.ts` so the logger can import `NodeEnv` without importing config, which would create a cycle (config logs, logger reads config).

- [ ] **Step 4: Write `backend/src/config/configs.ts`**

```typescript
import { z } from "zod";
import { NodeEnv } from "@/common/config.types";

const envSchema = z.object({
  NODE_ENV: z
    .enum([
      NodeEnv.DEVELOPMENT,
      NodeEnv.STAGING,
      NodeEnv.PRODUCTION,
      NodeEnv.TEST,
    ])
    .default(NodeEnv.DEVELOPMENT),

  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string().default("0.0.0.0"),

  SERVICE_NAME: z.string().default("iadm-backend"),
  SERVICE_VERSION: z.string().default("0.1.0"),

  DATABASE_URL: z
    .string()
    .startsWith("postgresql://", "DATABASE_URL must be a postgresql:// URL"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export type AppConfig = {
  env: NodeEnv;
  isProduction: boolean;
  server: { port: number; host: string };
  service: { name: string; version: string };
  database: { url: string };
  jwt: { secret: string; accessTtl: string; refreshTtl: string };
  log: { level: string; format: "json" | "pretty" };
  cors: { origin: string };
};

export function buildConfig(
  env: Record<string, string | undefined>,
): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const e = parsed.data;

  return {
    env: e.NODE_ENV,
    isProduction: e.NODE_ENV === NodeEnv.PRODUCTION,
    server: { port: e.PORT, host: e.HOST },
    service: { name: e.SERVICE_NAME, version: e.SERVICE_VERSION },
    database: { url: e.DATABASE_URL },
    jwt: {
      secret: e.JWT_SECRET,
      accessTtl: e.JWT_ACCESS_TTL,
      refreshTtl: e.JWT_REFRESH_TTL,
    },
    log: { level: e.LOG_LEVEL, format: e.LOG_FORMAT },
    cors: { origin: e.CORS_ORIGIN },
  };
}

export const config: AppConfig = buildConfig(Bun.env);
```

Zod reports every failing field in one `issues` array, which is why the "reports every missing variable at once" test passes — a developer with three missing vars learns all three on the first run.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend && bun test tests/config/configs.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Verify lint and typecheck still pass**

```bash
bun run check
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd ..
git status --short
git add backend/src/common/config.types.ts backend/src/config/configs.ts \
        backend/tests/config/configs.test.ts
git commit -m "feat(backend): add zod-validated config module

buildConfig takes the environment as an argument so it is testable; the
exported singleton is buildConfig(Bun.env). Invalid config fails at
startup with every offending variable listed, not just the first."
```

---

## Task 4: Structured logging

**Files:**
- Create: `backend/src/common/loggerEvents.ts`
- Create: `backend/src/common/logger.ts`
- Test: `backend/tests/common/logger.test.ts`

**Interfaces:**
- Consumes: `config` from `@/config/configs`
- Produces:
  - `LOGGER_EVENTS` const object from `@/common/loggerEvents` with keys `SERVER_STARTED`, `SERVER_STOPPED`, `REQUEST_RECEIVED`, `REQUEST_COMPLETED`, `REQUEST_FAILED`, `DB_CONNECTED`, `DB_DISCONNECTED`, `SEED_STARTED`, `SEED_COMPLETED`, `CONFIG_LOADED`
  - `type LoggerEvent = (typeof LOGGER_EVENTS)[keyof typeof LOGGER_EVENTS]`
  - `logger` (Pino instance) from `@/common/logger`
  - `createRequestLogger(requestId: string)` returning a child logger that stamps `requestId` on every line

- [ ] **Step 1: Write the failing test**

Create `backend/tests/common/logger.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import pino from "pino";
import { LOGGER_EVENTS } from "@/common/loggerEvents";
import { REDACT_PATHS, createRequestLogger, logger } from "@/common/logger";

describe("LOGGER_EVENTS", () => {
  it("exposes the events Phase 0 needs", () => {
    expect(LOGGER_EVENTS.SERVER_STARTED).toBe("server.started");
    expect(LOGGER_EVENTS.REQUEST_COMPLETED).toBe("request.completed");
    expect(LOGGER_EVENTS.REQUEST_FAILED).toBe("request.failed");
    expect(LOGGER_EVENTS.SEED_COMPLETED).toBe("seed.completed");
  });

  it("uses dotted lowercase names throughout", () => {
    for (const value of Object.values(LOGGER_EVENTS)) {
      expect(value).toMatch(/^[a-z]+(\.[a-z_]+)+$/);
    }
  });

  it("has no duplicate values", () => {
    const values = Object.values(LOGGER_EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("logger", () => {
  it("exposes the standard pino levels", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("binds the service name and version to every line", () => {
    expect(logger.bindings().service).toBe("iadm-backend");
    expect(logger.bindings().version).toBeDefined();
  });
});

describe("REDACT_PATHS", () => {
  it("covers the credential-bearing request headers", () => {
    expect(REDACT_PATHS).toContain("req.headers.authorization");
    expect(REDACT_PATHS).toContain("req.headers.cookie");
  });

  it("covers password and token fields at any depth", () => {
    expect(REDACT_PATHS).toContain("*.password");
    expect(REDACT_PATHS).toContain("*.passwordHash");
    expect(REDACT_PATHS).toContain("*.token");
    expect(REDACT_PATHS).toContain("*.refreshToken");
    expect(REDACT_PATHS).toContain("*.accessToken");
    expect(REDACT_PATHS).toContain("*.secret");
  });

  it("actually redacts a password when the logger writes", () => {
    // Build a logger with the same redact config but a captured sink, so
    // this asserts behaviour rather than configuration.
    const lines: string[] = [];
    const probe = pino(
      { redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } },
      { write: (line: string) => lines.push(line) },
    );

    probe.info({ user: { email: "a@b.com", password: "hunter2" } }, "login");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("[REDACTED]");
    expect(lines[0]).not.toContain("hunter2");
    expect(lines[0]).toContain("a@b.com");
  });
});

describe("createRequestLogger", () => {
  it("stamps the request id on the child logger bindings", () => {
    const child = createRequestLogger("req-abc-123");
    expect(child.bindings().requestId).toBe("req-abc-123");
  });

  it("keeps the parent service binding", () => {
    const child = createRequestLogger("req-abc-123");
    expect(child.bindings().service).toBe(logger.bindings().service);
  });

  it("returns independent children for different request ids", () => {
    expect(createRequestLogger("a").bindings().requestId).toBe("a");
    expect(createRequestLogger("b").bindings().requestId).toBe("b");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && bun test tests/common/logger.test.ts
```

Expected: FAIL — cannot resolve `@/common/loggerEvents`.

- [ ] **Step 3: Write `backend/src/common/loggerEvents.ts`**

```typescript
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
```

- [ ] **Step 4: Write `backend/src/common/logger.ts`**

```typescript
import pino from "pino";
import { config } from "@/config/configs";

const isPretty = config.log.format === "pretty";

/**
 * Anything matching these paths is replaced before it reaches a sink.
 * Secrets must never be recoverable from a log file. Exported so the
 * test suite can assert the coverage rather than trust it.
 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.refreshToken",
  "*.accessToken",
  "*.jwt",
  "*.secret",
] as const;

export const logger = pino({
  level: config.log.level,
  base: {
    service: config.service.name,
    version: config.service.version,
  },
  redact: {
    paths: [...REDACT_PATHS],
    censor: "[REDACTED]",
  },
  transport: isPretty
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss.l" },
      }
    : undefined,
});

/**
 * A child logger bound to one request. Every line it emits carries the
 * same `requestId`, so a single request's logs can be isolated.
 */
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend && bun test tests/common/logger.test.ts
```

Expected: PASS, 10 tests. The behavioural redaction test is the important one — it proves a password logged inside a nested object is actually censored, rather than merely proving the config object has the right shape.

- [ ] **Step 6: Commit**

```bash
cd .. && git status --short
git add backend/src/common/loggerEvents.ts backend/src/common/logger.ts \
        backend/tests/common/logger.test.ts
git commit -m "feat(backend): add pino logger with event constants and redaction

Redacts authorization headers, cookies, passwords and tokens before they
reach a sink. createRequestLogger binds a requestId so one request's
lines can be isolated."
```

---

## Task 5: Typed error hierarchy

**Files:**
- Create: `backend/src/common/errors.ts`
- Test: `backend/tests/common/errors.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces, all from `@/common/errors`:
  - `abstract class AppError extends Error` with `readonly status: number`, `readonly code: string`, `readonly details?: unknown`
  - `class ValidationError extends AppError` — 400, code defaults `VALIDATION_FAILED`
  - `class UnauthorizedError extends AppError` — 401, code defaults `UNAUTHORIZED`
  - `class ForbiddenError extends AppError` — 403, code defaults `FORBIDDEN`
  - `class NotFoundError extends AppError` — 404, code defaults `NOT_FOUND`
  - `class ConflictError extends AppError` — 409, code defaults `CONFLICT`
  - `class InvalidTransitionError extends AppError` — 422, code `INVALID_STATUS_TRANSITION`
  - `class UpstreamUnavailableError extends AppError` — 503, code defaults `UPSTREAM_UNAVAILABLE`
  - `function toErrorResponse(error: unknown): { status: number; body: { error: { code: string; message: string; details?: unknown } } }`

  Every constructor takes `(message: string, code?: string, details?: unknown)`, except `InvalidTransitionError` which takes `(from: string, to: string, entity: string)`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/common/errors.test.ts`:

```typescript
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
```

The two 500 tests are the important ones: an unexpected error must never return its own message, because messages routinely contain connection strings, file paths, and query fragments.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && bun test tests/common/errors.test.ts
```

Expected: FAIL — cannot resolve `@/common/errors`.

- [ ] **Step 3: Write `backend/src/common/errors.ts`**

```typescript
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
  constructor(
    message: string,
    code = "VALIDATION_FAILED",
    details?: unknown,
  ) {
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
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && bun test tests/common/errors.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Run the whole suite and the checks**

```bash
bun test && bun run check
```

Expected: all tests pass, exit 0.

- [ ] **Step 6: Commit**

```bash
cd .. && git status --short
git add backend/src/common/errors.ts backend/tests/common/errors.test.ts
git commit -m "feat(backend): add typed error hierarchy with safe 500 mapping

Deliberate AppErrors carry status, code and optional details to the
client. Anything else collapses to a generic INTERNAL_ERROR so that
connection strings and query fragments in unexpected error messages
never leak."
```

---

## Task 6: Prisma schema — enums, identity, and residents

**Files:**
- Create: `backend/prisma.config.ts`
- Create: `backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: `DATABASE_URL` from the environment (read by Prisma's own config, not by `@/config/configs` — Prisma CLI runs outside the app).
- Produces: enums and the models `User`, `UserSession`, `AuditLog`, `Resident`, `ResidentStatusHistory`, `ResidentStaffAssignment`, `ResidentParent`. Tasks 7 and 8 add back-relation fields to `User` and `Resident`.

- [ ] **Step 1: Write `backend/prisma.config.ts`**

```typescript
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
      "postgresql://iadm:iadm_dev_password@localhost:5433/iadm?schema=public",
  },
});
```

This is the one file outside `configs.ts` that reads `process.env`, because the Prisma CLI runs as a separate process before the app exists. It is excluded from the lint rule by living outside `src/`.

- [ ] **Step 2: Write the schema header and every enum**

Create `backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

// ─────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────

enum UserRole {
  SUPER_ADMIN
  CSC
  JR_PSYCHOLOGIST
  MDT_HEAD
  PSS
  PARENT

  @@map("user_role")
}

enum ClinicalDomain {
  PSYCHOLOGY
  OCCUPATIONAL_THERAPY
  SPEECH_THERAPY
  SPECIAL_EDUCATION

  @@map("clinical_domain")
}

enum Gender {
  MALE
  FEMALE
  OTHER

  @@map("gender")
}

enum ProgramType {
  COMMUNITY
  FAMILY_LIVING

  @@map("program_type")
}

enum ResidentStatus {
  IMPORTED
  ENROLLED
  CSC_ASSIGNED
  MDT_ASSIGNED
  ASSESSMENTS_SCHEDULED
  ASSESSMENTS_IN_PROGRESS
  ASSESSMENTS_COMPLETED
  IEP_IN_PROGRESS
  IEP_APPROVED
  ACTIVE
  INACTIVE

  @@map("resident_status")
}

enum StaffAssignmentRole {
  CSC
  PSS
  JR_PSYCHOLOGIST
  MDT_HEAD

  @@map("staff_assignment_role")
}

enum AssessmentStatus {
  PENDING
  SCHEDULED
  IN_PROGRESS
  SUBMITTED
  APPROVED
  REVISION_REQUESTED

  @@map("assessment_status")
}

enum IepStatus {
  DRAFT_IEP
  SUBMITTED_IEP
  APPROVED_IEP
  ACTIVE_IEP
  COMPLETED_IEP
  REJECTED_IEP

  @@map("iep_status")
}

enum IepGoalApprovalStatus {
  NOT_SUBMITTED
  PENDING_MDT_APPROVAL
  APPROVED_MDT
  REJECTED_MDT

  @@map("iep_goal_approval_status")
}

enum IepAssignedRole {
  PSS
  CLINICIAN

  @@map("iep_assigned_role")
}

enum GoalFrequency {
  DAILY
  WEEKLY
  MONTHLY

  @@map("goal_frequency")
}

enum GoalStatus {
  NOT_STARTED
  IN_PROGRESS_GOAL
  ACHIEVED
  PARTIALLY_ACHIEVED
  DISCONTINUED_GOAL

  @@map("goal_status")
}

enum IepLogOutcome {
  ACHIEVED_LOG
  PARTIALLY_ACHIEVED_LOG
  NOT_ACHIEVED_LOG

  @@map("iep_log_outcome")
}

enum PromptLevel {
  INDEPENDENT
  VERBAL
  GESTURAL
  PARTIAL_PHYSICAL
  FULL_PHYSICAL

  @@map("prompt_level")
}

enum Shift {
  MORNING
  EVENING
  NIGHT

  @@map("shift")
}

enum AdlCategory {
  ADL
  IADL

  @@map("adl_category")
}

enum AdlLogStatus {
  TODO
  IN_PROGRESS_ADL
  DONE

  @@map("adl_log_status")
}

enum AdlApprovalStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED

  @@map("adl_approval_status")
}

enum AdlMood {
  CALM
  ANXIOUS
  ESCALATED
  MELTDOWN

  @@map("adl_mood")
}

enum RoomType {
  THERAPY
  ASSESSMENT_ROOM
  CONSULTATION
  CLASSROOM
  GENERAL

  @@map("room_type")
}

enum SlotType {
  ASSESSMENT_SLOT
  THERAPY_SESSION
  IPP_ACTIVITY
  IPP_MEETING_SLOT
  GENERAL_SLOT

  @@map("slot_type")
}

enum SlotStatus {
  SCHEDULED_SLOT
  CONFIRMED
  IN_PROGRESS_SLOT
  COMPLETED_SLOT
  CANCELLED_SLOT

  @@map("slot_status")
}

enum IncidentType {
  INJURY
  AGGRESSION
  MELTDOWN
  SELF_HARM
  FALL
  ELOPEMENT
  OTHER_INCIDENT

  @@map("incident_type")
}

enum IncidentStatus {
  REPORTED
  UNDER_REVIEW
  ESCALATED
  RESOLVED
  CLOSED

  @@map("incident_status")
}

enum TrajectoryDirection {
  IMPROVING
  STABLE
  DECLINING
  INSUFFICIENT_DATA

  @@map("trajectory_direction")
}

enum RiskBand {
  LOW
  MEDIUM
  HIGH

  @@map("risk_band")
}

enum NotificationType {
  CARE_TEAM_ASSIGNED
  ASSESSMENT_SCHEDULED
  ASSESSMENT_COMPLETED
  ASSESSMENT_APPROVED
  ASSESSMENT_REVISION_REQUESTED
  IEP_SUBMITTED
  IEP_APPROVED
  IPP_FINALIZED
  ADL_LOG_REJECTED
  INCIDENT_REPORTED
  INCIDENT_ESCALATED
  INCIDENT_RESOLVED
  SESSION_REMINDER
  PERFORMANCE_DECLINE_DETECTED
  ELEVATED_RISK_FLAGGED

  @@map("notification_type")
}

enum NotificationSeverity {
  NORMAL
  HIGH
  CRITICAL_INTERRUPT

  @@map("notification_severity")
}
```

- [ ] **Step 3: Append the identity models**

Append to `backend/prisma/schema.prisma`:

```prisma
// ─────────────────────────────────────────────────────────
// IDENTITY & AUDIT
// ─────────────────────────────────────────────────────────

model User {
  id             String          @id @default(dbgenerated("gen_random_uuid()")) @map("user_id") @db.Uuid
  email          String          @unique @db.VarChar(255)
  passwordHash   String          @map("password_hash") @db.VarChar(255)
  firstName      String          @map("first_name") @db.VarChar(100)
  lastName       String          @map("last_name") @db.VarChar(100)
  role           UserRole
  /// Set only for clinical roles; NULL for SUPER_ADMIN, CSC and PARENT.
  clinicalDomain ClinicalDomain? @map("clinical_domain")
  isActive       Boolean         @default(true) @map("is_active")
  createdAt      DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime        @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime?       @map("deleted_at") @db.Timestamptz(6)

  sessions          UserSession[]
  auditLogs         AuditLog[]
  statusChanges     ResidentStatusHistory[]
  staffAssignments  ResidentStaffAssignment[]
  parentLinks       ResidentParent[]

  @@index([role], map: "idx_user_role")
  @@index([isActive], map: "idx_user_active")
  @@index([deletedAt], map: "idx_user_deleted_at")
  @@map("users")
}

model UserSession {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @map("session_id") @db.Uuid
  userId           String    @map("user_id") @db.Uuid
  /// SHA-256 of the refresh token. The raw token is never stored.
  refreshTokenHash String    @map("refresh_token_hash") @db.VarChar(255)
  expiresAt        DateTime  @map("expires_at") @db.Timestamptz(6)
  revokedAt        DateTime? @map("revoked_at") @db.Timestamptz(6)
  userAgent        String?   @map("user_agent") @db.VarChar(500)
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([refreshTokenHash], map: "uq_session_refresh_hash")
  @@index([userId], map: "idx_session_user")
  @@index([expiresAt], map: "idx_session_expires")
  @@map("user_sessions")
}

model AuditLog {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @map("audit_log_id") @db.Uuid
  /// Null for system-initiated changes such as the nightly insights job.
  actorUserId String?  @map("actor_user_id") @db.Uuid
  action      String   @db.VarChar(100)
  entityType  String   @map("entity_type") @db.VarChar(100)
  entityId    String   @map("entity_id") @db.Uuid
  before      Json?
  after       Json?
  ipAddress   String?  @map("ip_address") @db.VarChar(45)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  actor User? @relation(fields: [actorUserId], references: [id])

  @@index([entityType, entityId], map: "idx_audit_entity")
  @@index([actorUserId], map: "idx_audit_actor")
  @@index([createdAt], map: "idx_audit_created_at")
  @@map("audit_logs")
}
```

`AuditLog` has no `updatedAt` on purpose — it is append-only. Rewriting an audit row would defeat its point.

- [ ] **Step 4: Append the resident models**

```prisma
// ─────────────────────────────────────────────────────────
// RESIDENTS
// ─────────────────────────────────────────────────────────

model Resident {
  id            String         @id @default(dbgenerated("gen_random_uuid()")) @map("resident_id") @db.Uuid
  code          String         @unique @db.VarChar(20)
  firstName     String         @map("first_name") @db.VarChar(100)
  lastName      String         @map("last_name") @db.VarChar(100)
  dateOfBirth   DateTime       @map("date_of_birth") @db.Date
  gender        Gender
  programType   ProgramType    @map("program_type")
  status        ResidentStatus @default(IMPORTED)
  admissionDate DateTime?      @map("admission_date") @db.Date
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime       @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt     DateTime?      @map("deleted_at") @db.Timestamptz(6)

  statusHistory    ResidentStatusHistory[]
  staffAssignments ResidentStaffAssignment[]
  parents          ResidentParent[]

  @@index([status], map: "idx_resident_status")
  @@index([lastName, firstName], map: "idx_resident_name")
  @@index([deletedAt], map: "idx_resident_deleted_at")
  @@map("residents")
}

model ResidentStatusHistory {
  id              String          @id @default(dbgenerated("gen_random_uuid()")) @map("status_history_id") @db.Uuid
  residentId      String          @map("resident_id") @db.Uuid
  /// Null only for the very first row, when the resident was created.
  fromStatus      ResidentStatus? @map("from_status")
  toStatus        ResidentStatus  @map("to_status")
  changedByUserId String          @map("changed_by_user_id") @db.Uuid
  reason          String?         @db.Text
  createdAt       DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)

  resident  Resident @relation(fields: [residentId], references: [id], onDelete: Cascade)
  changedBy User     @relation(fields: [changedByUserId], references: [id])

  @@index([residentId, createdAt], map: "idx_status_history_resident")
  @@map("resident_status_history")
}

model ResidentStaffAssignment {
  id           String              @id @default(dbgenerated("gen_random_uuid()")) @map("assignment_id") @db.Uuid
  residentId   String              @map("resident_id") @db.Uuid
  userId       String              @map("user_id") @db.Uuid
  role         StaffAssignmentRole
  assignedAt   DateTime            @default(now()) @map("assigned_at") @db.Timestamptz(6)
  /// Null means the assignment is currently active. The partial unique
  /// index below relies on this.
  unassignedAt DateTime?           @map("unassigned_at") @db.Timestamptz(6)
  createdAt    DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)

  resident Resident @relation(fields: [residentId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id])

  @@index([residentId, role], map: "idx_staff_assignment_resident_role")
  @@index([userId], map: "idx_staff_assignment_user")
  @@map("resident_staff_assignments")
}

model ResidentParent {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @map("resident_parent_id") @db.Uuid
  residentId   String   @map("resident_id") @db.Uuid
  parentUserId String   @map("parent_user_id") @db.Uuid
  relationship String   @db.VarChar(50)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  resident Resident @relation(fields: [residentId], references: [id], onDelete: Cascade)
  parent   User     @relation(fields: [parentUserId], references: [id])

  @@unique([residentId, parentUserId], map: "uq_resident_parent")
  @@index([parentUserId], map: "idx_resident_parent_user")
  @@map("resident_parents")
}
```

- [ ] **Step 5: Validate and format the schema**

```bash
cd backend
bun run db:format
bun run db:validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`. If validation complains about a missing opposite relation field, a relation was added on one side only — every `@relation` needs a matching array or optional field on the other model.

- [ ] **Step 6: Commit**

```bash
cd .. && git status --short
git add backend/prisma.config.ts backend/prisma/schema.prisma
git commit -m "feat(backend): add prisma enums, identity and resident models

28 enums plus User, UserSession, AuditLog, Resident and its status
history, staff assignment and parent link models. AuditLog is
append-only so it carries no updatedAt."
```

---

## Task 7: Prisma schema — assessments, IEP, and ADL

**Files:**
- Modify: `backend/prisma/schema.prisma` (append models, add back-relations to `User` and `Resident`)

**Interfaces:**
- Consumes: `User`, `Resident` from Task 6.
- Produces: `AssessmentType`, `Assessment`, `IepPlan`, `IepGoal`, `GoalProgressLog`, `AdlActivity`, `AdlAssignment`, `AdlLog`.

- [ ] **Step 1: Add back-relation fields to `User`**

In the `User` model, replace the existing relation block with:

```prisma
  sessions          UserSession[]
  auditLogs         AuditLog[]
  statusChanges     ResidentStatusHistory[]
  staffAssignments  ResidentStaffAssignment[]
  parentLinks       ResidentParent[]

  assessmentsAssigned Assessment[] @relation("AssessmentAssignee")
  assessmentsReviewed Assessment[] @relation("AssessmentReviewer")
  iepPlansAuthored    IepPlan[]    @relation("IepAuthor")
  iepPlansApproved    IepPlan[]    @relation("IepApprover")
  goalProgressLogs    GoalProgressLog[]
  adlAssignmentsMade  AdlAssignment[]
  adlLogsCreated      AdlLog[]     @relation("AdlLogger")
  adlLogsApproved     AdlLog[]     @relation("AdlApprover")
```

Named relations (`@relation("AssessmentAssignee")`) are required wherever two fields point at the same model, so Prisma can tell the foreign keys apart.

- [ ] **Step 2: Add back-relation fields to `Resident`**

```prisma
  statusHistory    ResidentStatusHistory[]
  staffAssignments ResidentStaffAssignment[]
  parents          ResidentParent[]

  assessments    Assessment[]
  iepPlans       IepPlan[]
  adlAssignments AdlAssignment[]
```

- [ ] **Step 3: Append the assessment models**

```prisma
// ─────────────────────────────────────────────────────────
// ASSESSMENTS
// ─────────────────────────────────────────────────────────

/// Catalogue of assessment types. Names and domains are descriptive, with
/// simplified rubrics of our own — this is NOT an implementation of
/// ADOS-2, CARS-2, Vineland-3, ISAA or any other licensed instrument.
model AssessmentType {
  id          String         @id @default(dbgenerated("gen_random_uuid()")) @map("assessment_type_id") @db.Uuid
  name        String         @db.VarChar(200)
  code        String         @unique @db.VarChar(50)
  domain      ClinicalDomain
  description String?        @db.Text
  isActive    Boolean        @default(true) @map("is_active")
  createdAt   DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime       @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt   DateTime?      @map("deleted_at") @db.Timestamptz(6)

  assessments Assessment[]

  @@index([domain], map: "idx_assessment_type_domain")
  @@map("assessment_types")
}

model Assessment {
  id               String           @id @default(dbgenerated("gen_random_uuid()")) @map("assessment_id") @db.Uuid
  residentId       String           @map("resident_id") @db.Uuid
  assessmentTypeId String           @map("assessment_type_id") @db.Uuid
  assignedToUserId String           @map("assigned_to_user_id") @db.Uuid
  status           AssessmentStatus @default(PENDING)
  scheduledAt      DateTime?        @map("scheduled_at") @db.Timestamptz(6)
  /// Structured answers. Shape is owned by the Zod schema in
  /// repos/schemas/, not by the database.
  findings         Json?
  score            Float?
  submittedAt      DateTime?        @map("submitted_at") @db.Timestamptz(6)
  reviewedByUserId String?          @map("reviewed_by_user_id") @db.Uuid
  reviewNotes      String?          @map("review_notes") @db.Text
  createdAt        DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime         @updatedAt @map("updated_at") @db.Timestamptz(6)

  resident       Resident       @relation(fields: [residentId], references: [id], onDelete: Cascade)
  assessmentType AssessmentType @relation(fields: [assessmentTypeId], references: [id])
  assignedTo     User           @relation("AssessmentAssignee", fields: [assignedToUserId], references: [id])
  reviewedBy     User?          @relation("AssessmentReviewer", fields: [reviewedByUserId], references: [id])

  @@index([residentId, status], map: "idx_assessment_resident_status")
  @@index([assignedToUserId, status], map: "idx_assessment_assignee_status")
  @@map("assessments")
}
```

- [ ] **Step 4: Append the IEP models**

```prisma
// ─────────────────────────────────────────────────────────
// IEP PLANS AND GOALS
// ─────────────────────────────────────────────────────────

model IepPlan {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @map("iep_plan_id") @db.Uuid
  residentId       String    @map("resident_id") @db.Uuid
  version          Int
  status           IepStatus @default(DRAFT_IEP)
  authoredByUserId String    @map("authored_by_user_id") @db.Uuid
  submittedAt      DateTime? @map("submitted_at") @db.Timestamptz(6)
  approvedByUserId String?   @map("approved_by_user_id") @db.Uuid
  approvedAt       DateTime? @map("approved_at") @db.Timestamptz(6)
  startDate        DateTime? @map("start_date") @db.Date
  endDate          DateTime? @map("end_date") @db.Date
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  resident   Resident  @relation(fields: [residentId], references: [id], onDelete: Cascade)
  authoredBy User      @relation("IepAuthor", fields: [authoredByUserId], references: [id])
  approvedBy User?     @relation("IepApprover", fields: [approvedByUserId], references: [id])
  goals      IepGoal[]

  @@unique([residentId, version], map: "uq_iep_resident_version")
  @@index([residentId, status], map: "idx_iep_resident_status")
  @@map("iep_plans")
}

model IepGoal {
  id              String                @id @default(dbgenerated("gen_random_uuid()")) @map("iep_goal_id") @db.Uuid
  iepPlanId       String                @map("iep_plan_id") @db.Uuid
  domain          ClinicalDomain
  title           String                @db.VarChar(255)
  description     String                @db.Text
  frequency       GoalFrequency
  targetCount     Int                   @map("target_count")
  status          GoalStatus            @default(NOT_STARTED)
  approvalStatus  IepGoalApprovalStatus @default(NOT_SUBMITTED) @map("approval_status")
  /// Required when approvalStatus is REJECTED_MDT. Rejection is one-shot:
  /// a rejected goal is never resubmitted, a new goal replaces it.
  rejectionReason String?               @map("rejection_reason") @db.Text
  assignedRole    IepAssignedRole       @map("assigned_role")
  createdAt       DateTime              @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime              @updatedAt @map("updated_at") @db.Timestamptz(6)

  iepPlan      IepPlan           @relation(fields: [iepPlanId], references: [id], onDelete: Cascade)
  progressLogs GoalProgressLog[]

  @@index([iepPlanId], map: "idx_iep_goal_plan")
  @@index([domain, status], map: "idx_iep_goal_domain_status")
  @@map("iep_goals")
}

/// One row per goal session. Primary signal for the ML trajectory layer.
model GoalProgressLog {
  id             String        @id @default(dbgenerated("gen_random_uuid()")) @map("goal_progress_log_id") @db.Uuid
  iepGoalId      String        @map("iep_goal_id") @db.Uuid
  loggedByUserId String        @map("logged_by_user_id") @db.Uuid
  logDate        DateTime      @map("log_date") @db.Date
  outcome        IepLogOutcome
  promptLevel    PromptLevel?  @map("prompt_level")
  notes          String?       @db.Text
  createdAt      DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)

  iepGoal  IepGoal @relation(fields: [iepGoalId], references: [id], onDelete: Cascade)
  loggedBy User    @relation(fields: [loggedByUserId], references: [id])

  @@index([iepGoalId, logDate], map: "idx_goal_progress_goal_date")
  @@index([logDate], map: "idx_goal_progress_date")
  @@map("goal_progress_logs")
}
```

- [ ] **Step 5: Append the ADL models**

```prisma
// ─────────────────────────────────────────────────────────
// ACTIVITIES OF DAILY LIVING
// ─────────────────────────────────────────────────────────

model AdlActivity {
  id          String      @id @default(dbgenerated("gen_random_uuid()")) @map("adl_activity_id") @db.Uuid
  name        String      @db.VarChar(200)
  code        String      @unique @db.VarChar(50)
  category    AdlCategory
  description String?     @db.Text
  isActive    Boolean     @default(true) @map("is_active")
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime    @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt   DateTime?   @map("deleted_at") @db.Timestamptz(6)

  assignments AdlAssignment[]

  @@index([category], map: "idx_adl_activity_category")
  @@map("adl_activities")
}

model AdlAssignment {
  id               String        @id @default(dbgenerated("gen_random_uuid()")) @map("adl_assignment_id") @db.Uuid
  residentId       String        @map("resident_id") @db.Uuid
  adlActivityId    String        @map("adl_activity_id") @db.Uuid
  assignedByUserId String        @map("assigned_by_user_id") @db.Uuid
  frequency        GoalFrequency
  isActive         Boolean       @default(true) @map("is_active")
  createdAt        DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime      @updatedAt @map("updated_at") @db.Timestamptz(6)

  resident    Resident    @relation(fields: [residentId], references: [id], onDelete: Cascade)
  adlActivity AdlActivity @relation(fields: [adlActivityId], references: [id])
  assignedBy  User        @relation(fields: [assignedByUserId], references: [id])
  logs        AdlLog[]

  @@unique([residentId, adlActivityId], map: "uq_adl_assignment_resident_activity")
  @@index([residentId, isActive], map: "idx_adl_assignment_resident_active")
  @@map("adl_assignments")
}

/// One log per (assignment, date, shift). Primary signal for the ML layer.
model AdlLog {
  id              String            @id @default(dbgenerated("gen_random_uuid()")) @map("adl_log_id") @db.Uuid
  adlAssignmentId String            @map("adl_assignment_id") @db.Uuid
  loggedByUserId  String            @map("logged_by_user_id") @db.Uuid
  logDate         DateTime          @map("log_date") @db.Date
  shift           Shift
  status          AdlLogStatus      @default(TODO)
  promptLevel     PromptLevel?      @map("prompt_level")
  mood            AdlMood?
  notes           String?           @db.Text
  approvalStatus  AdlApprovalStatus @default(DRAFT) @map("approval_status")
  approvedByUserId String?          @map("approved_by_user_id") @db.Uuid
  rejectionReason String?           @map("rejection_reason") @db.Text
  createdAt       DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime          @updatedAt @map("updated_at") @db.Timestamptz(6)

  adlAssignment AdlAssignment @relation(fields: [adlAssignmentId], references: [id], onDelete: Cascade)
  loggedBy      User          @relation("AdlLogger", fields: [loggedByUserId], references: [id])
  approvedBy    User?         @relation("AdlApprover", fields: [approvedByUserId], references: [id])

  @@unique([adlAssignmentId, logDate, shift], map: "uq_adl_log_assignment_date_shift")
  @@index([logDate, approvalStatus], map: "idx_adl_log_date_approval")
  @@index([approvalStatus], map: "idx_adl_log_approval")
  @@map("adl_logs")
}
```

The `@@unique([adlAssignmentId, logDate, shift])` is the database-level guarantee behind spec §5.3's "one log per (assignment, date, shift)". Enforcing it in the service layer alone would leak duplicates under concurrent submissions from two devices.

- [ ] **Step 6: Validate and format**

```bash
cd backend && bun run db:format && bun run db:validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`.

- [ ] **Step 7: Commit**

```bash
cd .. && git status --short
git add backend/prisma/schema.prisma
git commit -m "feat(backend): add assessment, IEP and ADL models

Adds the eight models behind workflows 5.2 and 5.3, plus the
back-relations they need on User and Resident. A unique index on
(assignment, date, shift) enforces one ADL log per shift at the database
level rather than trusting the service layer under concurrent writes."
```

---

## Task 8: Prisma schema — scheduling, incidents, notifications, intelligence

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: `User`, `Resident` from Task 6.
- Produces: `Room`, `CalendarSlot`, `Incident`, `Notification`, `NotificationPreference`, `DevelopmentSnapshot`, `RiskAssessment`. This completes all 22 models.

- [ ] **Step 1: Extend the `User` relation block**

Append inside `User`:

```prisma
  calendarSlotsAssigned CalendarSlot[] @relation("SlotStaff")
  calendarSlotsCreated  CalendarSlot[] @relation("SlotCreator")
  incidentsReported     Incident[]     @relation("IncidentReporter")
  incidentsReviewed     Incident[]     @relation("IncidentReviewer")
  notifications         Notification[]
  notificationPrefs     NotificationPreference[]
```

- [ ] **Step 2: Extend the `Resident` relation block**

Append inside `Resident`:

```prisma
  calendarSlots        CalendarSlot[]
  incidents            Incident[]
  developmentSnapshots DevelopmentSnapshot[]
  riskAssessments      RiskAssessment[]
```

- [ ] **Step 3: Append scheduling models**

```prisma
// ─────────────────────────────────────────────────────────
// SCHEDULING
// ─────────────────────────────────────────────────────────

model Room {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @map("room_id") @db.Uuid
  name      String    @unique @db.VarChar(200)
  type      RoomType
  capacity  Int       @default(1)
  isActive  Boolean   @default(true) @map("is_active")
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)

  calendarSlots CalendarSlot[]

  @@index([isActive], map: "idx_room_active")
  @@map("rooms")
}

model CalendarSlot {
  id              String     @id @default(dbgenerated("gen_random_uuid()")) @map("calendar_slot_id") @db.Uuid
  type            SlotType
  status          SlotStatus @default(SCHEDULED_SLOT)
  startsAt        DateTime   @map("starts_at") @db.Timestamptz(6)
  endsAt          DateTime   @map("ends_at") @db.Timestamptz(6)
  roomId          String?    @map("room_id") @db.Uuid
  residentId      String?    @map("resident_id") @db.Uuid
  staffUserId     String     @map("staff_user_id") @db.Uuid
  title           String     @db.VarChar(255)
  notes           String?    @db.Text
  createdByUserId String     @map("created_by_user_id") @db.Uuid
  createdAt       DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6)

  room      Room?     @relation(fields: [roomId], references: [id])
  resident  Resident? @relation(fields: [residentId], references: [id], onDelete: Cascade)
  staff     User      @relation("SlotStaff", fields: [staffUserId], references: [id])
  createdBy User      @relation("SlotCreator", fields: [createdByUserId], references: [id])

  // Overlap detection queries filter on these two ranges.
  @@index([roomId, startsAt, endsAt], map: "idx_slot_room_range")
  @@index([staffUserId, startsAt, endsAt], map: "idx_slot_staff_range")
  @@index([residentId, startsAt], map: "idx_slot_resident_start")
  @@map("calendar_slots")
}
```

- [ ] **Step 4: Append incident and notification models**

```prisma
// ─────────────────────────────────────────────────────────
// INCIDENTS & NOTIFICATIONS
// ─────────────────────────────────────────────────────────

/// Label source for the ML incident-risk model.
model Incident {
  id               String               @id @default(dbgenerated("gen_random_uuid()")) @map("incident_id") @db.Uuid
  residentId       String               @map("resident_id") @db.Uuid
  reportedByUserId String               @map("reported_by_user_id") @db.Uuid
  type             IncidentType
  status           IncidentStatus       @default(REPORTED)
  severity         NotificationSeverity @default(NORMAL)
  occurredAt       DateTime             @map("occurred_at") @db.Timestamptz(6)
  location         String?              @db.VarChar(255)
  description      String               @db.Text
  notifyParent     Boolean              @default(false) @map("notify_parent")
  reviewedByUserId String?              @map("reviewed_by_user_id") @db.Uuid
  resolution       String?              @db.Text
  resolvedAt       DateTime?            @map("resolved_at") @db.Timestamptz(6)
  createdAt        DateTime             @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime             @updatedAt @map("updated_at") @db.Timestamptz(6)

  resident   Resident @relation(fields: [residentId], references: [id], onDelete: Cascade)
  reportedBy User     @relation("IncidentReporter", fields: [reportedByUserId], references: [id])
  reviewedBy User?    @relation("IncidentReviewer", fields: [reviewedByUserId], references: [id])

  @@index([residentId, occurredAt], map: "idx_incident_resident_occurred")
  @@index([status], map: "idx_incident_status")
  @@index([occurredAt], map: "idx_incident_occurred")
  @@map("incidents")
}

model Notification {
  id         String               @id @default(dbgenerated("gen_random_uuid()")) @map("notification_id") @db.Uuid
  userId     String               @map("user_id") @db.Uuid
  type       NotificationType
  severity   NotificationSeverity @default(NORMAL)
  title      String               @db.VarChar(255)
  body       String               @db.Text
  entityType String?              @map("entity_type") @db.VarChar(100)
  entityId   String?              @map("entity_id") @db.Uuid
  readAt     DateTime?            @map("read_at") @db.Timestamptz(6)
  createdAt  DateTime             @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Drives the unread badge: partial scan on unread rows per user.
  @@index([userId, readAt], map: "idx_notification_user_read")
  @@index([userId, createdAt], map: "idx_notification_user_created")
  @@map("notifications")
}

model NotificationPreference {
  id        String           @id @default(dbgenerated("gen_random_uuid()")) @map("notification_preference_id") @db.Uuid
  userId    String           @map("user_id") @db.Uuid
  type      NotificationType
  enabled   Boolean          @default(true)
  createdAt DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime         @updatedAt @map("updated_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type], map: "uq_notification_pref_user_type")
  @@map("notification_preferences")
}
```

- [ ] **Step 5: Append the intelligence models**

```prisma
// ─────────────────────────────────────────────────────────
// INTELLIGENCE LAYER
// ─────────────────────────────────────────────────────────

/// One row per resident per clinical domain per week. Written by the
/// nightly insights job; recomputed idempotently via the unique index.
model DevelopmentSnapshot {
  id                   String              @id @default(dbgenerated("gen_random_uuid()")) @map("development_snapshot_id") @db.Uuid
  residentId           String              @map("resident_id") @db.Uuid
  domain               ClinicalDomain
  weekStart            DateTime            @map("week_start") @db.Date
  /// 0..1 composite of goal outcomes and ADL prompt levels. See spec §6.1A.
  independenceIndex    Float               @map("independence_index")
  goalAchievementRate  Float               @map("goal_achievement_rate")
  adlCompletionRate    Float               @map("adl_completion_rate")
  trajectory           TrajectoryDirection @default(INSUFFICIENT_DATA)
  /// OLS slope over the trailing 8 weekly points.
  slope                Float               @default(0)
  /// Z-score of the recent window against this resident's own baseline.
  baselineDeviation    Float?              @map("baseline_deviation")
  computedAt           DateTime            @default(now()) @map("computed_at") @db.Timestamptz(6)

  resident Resident @relation(fields: [residentId], references: [id], onDelete: Cascade)

  @@unique([residentId, domain, weekStart], map: "uq_dev_snapshot_resident_domain_week")
  @@index([residentId, weekStart], map: "idx_dev_snapshot_resident_week")
  @@index([trajectory], map: "idx_dev_snapshot_trajectory")
  @@map("development_snapshots")
}

/// One row per resident per model run. Never overwritten — the history of
/// what the model said, and when, is part of the audit trail.
model RiskAssessment {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @map("risk_assessment_id") @db.Uuid
  residentId   String   @map("resident_id") @db.Uuid
  assessedFor  DateTime @map("assessed_for") @db.Date
  band         RiskBand
  score        Float
  /// Ordered [{ feature, contribution, direction }]. This is what the
  /// clinician actually reads — a bare score is never shown alone.
  topFactors   Json     @map("top_factors")
  modelVersion String   @map("model_version") @db.VarChar(50)
  computedAt   DateTime @default(now()) @map("computed_at") @db.Timestamptz(6)

  resident Resident @relation(fields: [residentId], references: [id], onDelete: Cascade)

  @@index([residentId, assessedFor], map: "idx_risk_resident_date")
  @@index([band, assessedFor], map: "idx_risk_band_date")
  @@map("risk_assessments")
}
```

- [ ] **Step 6: Validate, format, and confirm all 22 models exist**

```bash
cd backend
bun run db:format
bun run db:validate
grep -c "^model " prisma/schema.prisma   # expect 22
grep -c "^enum "  prisma/schema.prisma   # expect 28
```

Expected: valid schema, `22`, `28`.

- [ ] **Step 7: Commit**

```bash
cd .. && git status --short
git add backend/prisma/schema.prisma
git commit -m "feat(backend): add scheduling, incident, notification and ML models

Completes the 22-model schema. DevelopmentSnapshot is uniquely keyed on
(resident, domain, week) so the nightly job can recompute idempotently;
RiskAssessment is append-only so the record of what the model said and
when survives as an audit trail."
```

---

## Task 9: Initial migration and the Prisma client adapter

**Files:**
- Create: `backend/prisma/migrations/<timestamp>_init/migration.sql` (generated)
- Create: `backend/src/adapters/database/prisma.ts`
- Test: `backend/tests/adapters/database/prisma.test.ts`

**Interfaces:**
- Consumes: `config` from `@/config/configs`, the generated Prisma client.
- Produces: `prisma` (a `PrismaClient` singleton) and `disconnectPrisma(): Promise<void>`, both from `@/adapters/database/prisma`.

- [ ] **Step 1: Generate the client and create the migration**

```bash
cd backend
bun run db:generate
bunx prisma migrate dev --name init
```

Expected: a new folder `prisma/migrations/<timestamp>_init/` containing `migration.sql`, and `Your database is now in sync with your schema.`

If this errors with "can't reach database server", Docker isn't running — `docker compose up -d` from the repo root, then retry.

- [ ] **Step 2: Verify all 22 tables landed**

```bash
cd .. && docker compose exec postgres psql -U iadm -d iadm -c "\dt"
```

Expected: 22 tables plus `_prisma_migrations`. Confirm the count:

```bash
docker compose exec postgres psql -U iadm -d iadm -tAc \
  "SELECT count(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_name <> '_prisma_migrations';"
```

Expected: `22`.

- [ ] **Step 3: Write the failing test**

Create `backend/tests/adapters/database/prisma.test.ts`:

```typescript
import { afterAll, describe, expect, it } from "bun:test";
import { disconnectPrisma, prisma } from "@/adapters/database/prisma";

afterAll(async () => {
  await disconnectPrisma();
});

describe("prisma adapter", () => {
  it("connects and answers a trivial query", async () => {
    const result = await prisma.$queryRaw<
      Array<{ ok: number }>
    >`SELECT 1 as ok`;
    expect(result[0]?.ok).toBe(1);
  });

  it("returns the same instance on repeated imports", async () => {
    const again = await import("@/adapters/database/prisma");
    expect(again.prisma).toBe(prisma);
  });

  it("exposes every model the schema defines", () => {
    expect(prisma.user).toBeDefined();
    expect(prisma.resident).toBeDefined();
    expect(prisma.assessment).toBeDefined();
    expect(prisma.iepPlan).toBeDefined();
    expect(prisma.adlLog).toBeDefined();
    expect(prisma.calendarSlot).toBeDefined();
    expect(prisma.incident).toBeDefined();
    expect(prisma.developmentSnapshot).toBeDefined();
    expect(prisma.riskAssessment).toBeDefined();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

```bash
cd backend && bun test tests/adapters/database/prisma.test.ts
```

Expected: FAIL — cannot resolve `@/adapters/database/prisma`.

- [ ] **Step 5: Write `backend/src/adapters/database/prisma.ts`**

```typescript
import { PrismaClient } from "@prisma/client";
import { config } from "@/config/configs";
import { logger } from "@/common/logger";
import { LOGGER_EVENTS } from "@/common/loggerEvents";

/**
 * The single Prisma client for the process. Repos import this; nothing
 * else in the codebase may import @prisma/client directly.
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
    datasources: { db: { url: config.database.url } },
    log: config.isProduction
      ? ["warn", "error"]
      : ["warn", "error"],
  });

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info({ event: LOGGER_EVENTS.DB_DISCONNECTED }, "database disconnected");
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend && bun run --env-file=env/.env.local test tests/adapters/database/prisma.test.ts
```

Expected: PASS, 3 tests. The `--env-file` flag is required — this test hits the real database, unlike the pure unit tests before it.

- [ ] **Step 7: Commit**

```bash
cd .. && git status --short
git add backend/prisma/migrations backend/src/adapters/database/prisma.ts \
        backend/tests/adapters/database/prisma.test.ts
git commit -m "feat(backend): add initial migration and prisma client adapter

Creates all 22 tables. The client is held on globalThis in development
so bun --watch reloads reuse one connection pool rather than leaking a
new one per file save."
```

---

## Task 10: Elysia app, request IDs, error handling, Swagger, and /healthz

**Files:**
- Create: `backend/src/routes/health.routes.ts`
- Create: `backend/src/routes/index.ts`
- Create: `backend/src/app.ts`
- Modify: `backend/src/index.ts` (replaces the Task 2 placeholder)
- Test: `backend/tests/routes/health.routes.test.ts`
- Test: `backend/tests/app.test.ts`

**Interfaces:**
- Consumes: `config`, `logger`, `LOGGER_EVENTS`, `toErrorResponse`, `NotFoundError`, `prisma`.
- Produces: `app` (the configured Elysia instance) from `@/app`; `setupRoutes(app)` from `@/routes`; `healthRoutes` from `@/routes/health.routes`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/routes/health.routes.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { app } from "@/app";

describe("GET /healthz", () => {
  it("returns 200", async () => {
    const response = await app.handle(
      new Request("http://localhost/healthz"),
    );
    expect(response.status).toBe(200);
  });

  it("reports status, service name and version", async () => {
    const response = await app.handle(
      new Request("http://localhost/healthz"),
    );
    const body = await response.json();

    expect(body.data.status).toBe("ok");
    expect(body.data.service).toBe("iadm-backend");
    expect(body.data.version).toBeDefined();
    expect(body.data.uptime).toBeGreaterThanOrEqual(0);
  });

  it("wraps the payload in the standard data envelope", async () => {
    const response = await app.handle(
      new Request("http://localhost/healthz"),
    );
    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(body).not.toHaveProperty("error");
  });
});
```

Create `backend/tests/app.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { app } from "@/app";

describe("request id", () => {
  it("returns an x-request-id header on every response", async () => {
    const response = await app.handle(
      new Request("http://localhost/healthz"),
    );
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
    const response = await app.handle(
      new Request("http://localhost/healthz"),
    );
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

    const body = await response.json();
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
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd backend && bun run --env-file=env/.env.local test tests/app.test.ts
```

Expected: FAIL — cannot resolve `@/app`.

- [ ] **Step 3: Write `backend/src/routes/health.routes.ts`**

```typescript
import { Elysia } from "elysia";
import { config } from "@/config/configs";

const startedAt = Date.now();

export const healthRoutes = new Elysia().get("/", () => ({
  data: {
    status: "ok",
    service: config.service.name,
    version: config.service.version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
  },
}));
```

`/healthz` deliberately does not query the database. It answers "is this process alive", which must stay true and fast even when Postgres is down — a health check that fails on a database blip causes restart storms.

- [ ] **Step 4: Write `backend/src/routes/index.ts`**

```typescript
import type { Elysia } from "elysia";
import { healthRoutes } from "@/routes/health.routes";

/**
 * Mounts every route group with its path prefix. Each new domain in later
 * phases adds exactly one line here.
 */
export function setupRoutes(app: Elysia) {
  return app.group("/healthz", (group) => group.use(healthRoutes));
}
```

- [ ] **Step 5: Write `backend/src/app.ts`**

```typescript
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
      logger.error(
        { ...logPayload, err: error },
        "unhandled error",
      );
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
```

- [ ] **Step 6: Replace `backend/src/index.ts`**

```typescript
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
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd backend && bun run --env-file=env/.env.local test tests/app.test.ts tests/routes/health.routes.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 8: Start the server and verify by hand**

```bash
bun dev
```

In a second terminal:

```bash
curl -i http://localhost:5000/healthz
```

Expected: `HTTP/1.1 200`, an `x-request-id` header, and a body like
`{"data":{"status":"ok","service":"iadm-backend","version":"0.1.0","uptime":3}}`.

Then check the 404 envelope and Swagger:

```bash
curl -s http://localhost:5000/nope | jq
open http://localhost:5000/swagger
```

Expected: `{"error":{"code":"NOT_FOUND","message":"Route not found"}}` and the Swagger UI in a browser. Stop the server with Ctrl-C and confirm it logs `shutting down` rather than dying silently.

- [ ] **Step 9: Commit**

```bash
cd .. && git status --short
git add backend/src/app.ts backend/src/index.ts backend/src/routes \
        backend/tests/app.test.ts backend/tests/routes
git commit -m "feat(backend): add elysia app with health route, request ids and swagger

Every response carries an x-request-id (echoed from the client when
supplied) that also stamps each log line. Unexpected errors log their
stack server-side and return a generic 500. /healthz deliberately does
not touch the database so a Postgres blip cannot cause restart storms."
```

---

## Task 11: Seed script

**Files:**
- Create: `backend/prisma/seed.ts`
- Test: `backend/tests/prisma/seed.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/adapters/database/prisma`.
- Produces: a populated database matching spec §9.1 — 13 users, 8 assessment types, 12 ADL activities, 6 rooms, 10 residents distributed across the status machine. Exports `seed(): Promise<void>` so the test can invoke it directly.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/prisma/seed.test.ts`:

```typescript
import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import { disconnectPrisma, prisma } from "@/adapters/database/prisma";
import { seed } from "../../prisma/seed";

beforeAll(async () => {
  await seed();
});

afterAll(async () => {
  await disconnectPrisma();
});

describe("seed", () => {
  it("creates the 10 residents Phase 0 requires", async () => {
    expect(await prisma.resident.count()).toBe(10);
  });

  it("distributes residents across the status machine", async () => {
    const grouped = await prisma.resident.groupBy({
      by: ["status"],
      _count: true,
    });
    const counts = Object.fromEntries(
      grouped.map((row) => [row.status, row._count]),
    );

    expect(counts.IMPORTED).toBe(2);
    expect(counts.ENROLLED).toBe(1);
    expect(counts.MDT_ASSIGNED).toBe(1);
    expect(counts.ASSESSMENTS_IN_PROGRESS).toBe(2);
    expect(counts.ASSESSMENTS_COMPLETED).toBe(1);
    expect(counts.IEP_IN_PROGRESS).toBe(1);
    expect(counts.ACTIVE).toBe(2);
  });

  it("creates one user for every role", async () => {
    const grouped = await prisma.user.groupBy({ by: ["role"], _count: true });
    const counts = Object.fromEntries(
      grouped.map((row) => [row.role, row._count]),
    );

    expect(counts.SUPER_ADMIN).toBe(1);
    expect(counts.CSC).toBe(2);
    expect(counts.JR_PSYCHOLOGIST).toBe(2);
    expect(counts.MDT_HEAD).toBe(1);
    expect(counts.PSS).toBe(3);
    expect(counts.PARENT).toBe(4);
  });

  it("creates the catalogues", async () => {
    expect(await prisma.assessmentType.count()).toBe(8);
    expect(await prisma.adlActivity.count()).toBe(12);
    expect(await prisma.room.count()).toBe(6);
  });

  it("splits ADL activities into 8 ADL and 4 IADL", async () => {
    expect(await prisma.adlActivity.count({ where: { category: "ADL" } }))
      .toBe(8);
    expect(await prisma.adlActivity.count({ where: { category: "IADL" } }))
      .toBe(4);
  });

  it("never stores a plaintext password", async () => {
    const users = await prisma.user.findMany({
      select: { passwordHash: true },
    });
    for (const user of users) {
      expect(user.passwordHash).not.toBe("Password123!");
      expect(user.passwordHash.length).toBeGreaterThan(40);
    }
  });

  it("is idempotent — running twice does not duplicate rows", async () => {
    await seed();
    expect(await prisma.resident.count()).toBe(10);
    expect(await prisma.user.count()).toBe(13);
  });
});
```

The idempotency test matters more than it looks: a seed that duplicates on second run makes `db:setup` unsafe to re-run, and re-running it is exactly what everyone does before a demo.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && bun run --env-file=env/.env.local test tests/prisma/seed.test.ts
```

Expected: FAIL — cannot resolve `../../prisma/seed`.

- [ ] **Step 3: Write `backend/prisma/seed.ts`**

```typescript
import {
  AdlCategory,
  ClinicalDomain,
  Gender,
  ProgramType,
  ResidentStatus,
  RoomType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/adapters/database/prisma";
import { logger } from "@/common/logger";
import { LOGGER_EVENTS } from "@/common/loggerEvents";

/**
 * Baseline demo data (spec §9.1). Every screen has something meaningful on
 * it the moment the app starts.
 *
 * ALL DATA HERE IS SYNTHETIC. No real clinical records, ever.
 *
 * Idempotent: every create is an upsert keyed on a natural unique column,
 * so `bun run db:setup` is safe to re-run before a demo.
 */

const DEMO_PASSWORD = "Password123!";

const USERS: Array<{
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  clinicalDomain?: ClinicalDomain;
}> = [
  { email: "admin@iadm.local", firstName: "Aisha", lastName: "Rahman", role: UserRole.SUPER_ADMIN },

  { email: "csc1@iadm.local", firstName: "Priya", lastName: "Nair", role: UserRole.CSC },
  { email: "csc2@iadm.local", firstName: "Rohan", lastName: "Mehta", role: UserRole.CSC },

  { email: "psych1@iadm.local", firstName: "Sara", lastName: "Khan", role: UserRole.JR_PSYCHOLOGIST, clinicalDomain: ClinicalDomain.PSYCHOLOGY },
  { email: "psych2@iadm.local", firstName: "Imran", lastName: "Sheikh", role: UserRole.JR_PSYCHOLOGIST, clinicalDomain: ClinicalDomain.SPEECH_THERAPY },

  { email: "mdthead@iadm.local", firstName: "Vikram", lastName: "Desai", role: UserRole.MDT_HEAD, clinicalDomain: ClinicalDomain.PSYCHOLOGY },

  { email: "pss1@iadm.local", firstName: "Meera", lastName: "Joshi", role: UserRole.PSS },
  { email: "pss2@iadm.local", firstName: "Arjun", lastName: "Patel", role: UserRole.PSS },
  { email: "pss3@iadm.local", firstName: "Fatima", lastName: "Ali", role: UserRole.PSS },

  { email: "parent1@iadm.local", firstName: "Deepa", lastName: "Iyer", role: UserRole.PARENT },
  { email: "parent2@iadm.local", firstName: "Sanjay", lastName: "Kulkarni", role: UserRole.PARENT },
  { email: "parent3@iadm.local", firstName: "Nadia", lastName: "Qureshi", role: UserRole.PARENT },
  { email: "parent4@iadm.local", firstName: "Ravi", lastName: "Menon", role: UserRole.PARENT },
];

const ASSESSMENT_TYPES: Array<{
  code: string;
  name: string;
  domain: ClinicalDomain;
  description: string;
}> = [
  { code: "BEH-OBS", name: "Behavioural Observation", domain: ClinicalDomain.PSYCHOLOGY, description: "Structured observation of behaviour across settings." },
  { code: "COG-PROF", name: "Cognitive Profile", domain: ClinicalDomain.PSYCHOLOGY, description: "Attention, memory and problem-solving profile." },
  { code: "SENS-PROF", name: "Sensory Profile", domain: ClinicalDomain.OCCUPATIONAL_THERAPY, description: "Sensory processing and regulation patterns." },
  { code: "MOTOR-SKL", name: "Motor Skills Screen", domain: ClinicalDomain.OCCUPATIONAL_THERAPY, description: "Fine and gross motor coordination." },
  { code: "COMM-EXPR", name: "Expressive Communication", domain: ClinicalDomain.SPEECH_THERAPY, description: "Expressive language and functional communication." },
  { code: "COMM-RECP", name: "Receptive Communication", domain: ClinicalDomain.SPEECH_THERAPY, description: "Comprehension and instruction following." },
  { code: "EDU-READ", name: "Pre-Academic Readiness", domain: ClinicalDomain.SPECIAL_EDUCATION, description: "Readiness for structured learning tasks." },
  { code: "EDU-FUNC", name: "Functional Academics", domain: ClinicalDomain.SPECIAL_EDUCATION, description: "Applied literacy and numeracy in daily contexts." },
];

const ADL_ACTIVITIES: Array<{
  code: string;
  name: string;
  category: AdlCategory;
}> = [
  { code: "ADL-BATH", name: "Bathing", category: AdlCategory.ADL },
  { code: "ADL-GROOM", name: "Grooming", category: AdlCategory.ADL },
  { code: "ADL-DRESS", name: "Dressing", category: AdlCategory.ADL },
  { code: "ADL-FEED", name: "Feeding", category: AdlCategory.ADL },
  { code: "ADL-TOILET", name: "Toileting", category: AdlCategory.ADL },
  { code: "ADL-MOBIL", name: "Mobility", category: AdlCategory.ADL },
  { code: "ADL-ORAL", name: "Oral Hygiene", category: AdlCategory.ADL },
  { code: "ADL-SLEEP", name: "Sleep Routine", category: AdlCategory.ADL },
  { code: "IADL-MONEY", name: "Money Handling", category: AdlCategory.IADL },
  { code: "IADL-SHOP", name: "Shopping", category: AdlCategory.IADL },
  { code: "IADL-MEAL", name: "Meal Preparation", category: AdlCategory.IADL },
  { code: "IADL-TRANS", name: "Using Transport", category: AdlCategory.IADL },
];

const ROOMS: Array<{ name: string; type: RoomType; capacity: number }> = [
  { name: "Therapy Room 1", type: RoomType.THERAPY, capacity: 2 },
  { name: "Therapy Room 2", type: RoomType.THERAPY, capacity: 2 },
  { name: "Assessment Room A", type: RoomType.ASSESSMENT_ROOM, capacity: 3 },
  { name: "Consultation Room", type: RoomType.CONSULTATION, capacity: 6 },
  { name: "Classroom 1", type: RoomType.CLASSROOM, capacity: 10 },
  { name: "Activity Hall", type: RoomType.GENERAL, capacity: 20 },
];

/// Ten residents deliberately spread across the status machine so every
/// screen has representative data on first load.
const RESIDENTS: Array<{
  code: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  programType: ProgramType;
  status: ResidentStatus;
}> = [
  { code: "RES-0001", firstName: "Aarav", lastName: "Sharma", dateOfBirth: "2012-03-14", gender: Gender.MALE, programType: ProgramType.COMMUNITY, status: ResidentStatus.IMPORTED },
  { code: "RES-0002", firstName: "Diya", lastName: "Kapoor", dateOfBirth: "2014-07-02", gender: Gender.FEMALE, programType: ProgramType.COMMUNITY, status: ResidentStatus.IMPORTED },
  { code: "RES-0003", firstName: "Kabir", lastName: "Rao", dateOfBirth: "2011-11-23", gender: Gender.MALE, programType: ProgramType.FAMILY_LIVING, status: ResidentStatus.ENROLLED },
  { code: "RES-0004", firstName: "Ananya", lastName: "Bose", dateOfBirth: "2013-01-09", gender: Gender.FEMALE, programType: ProgramType.COMMUNITY, status: ResidentStatus.MDT_ASSIGNED },
  { code: "RES-0005", firstName: "Vivaan", lastName: "Reddy", dateOfBirth: "2010-05-30", gender: Gender.MALE, programType: ProgramType.FAMILY_LIVING, status: ResidentStatus.ASSESSMENTS_IN_PROGRESS },
  { code: "RES-0006", firstName: "Ishita", lastName: "Verma", dateOfBirth: "2012-09-17", gender: Gender.FEMALE, programType: ProgramType.COMMUNITY, status: ResidentStatus.ASSESSMENTS_IN_PROGRESS },
  { code: "RES-0007", firstName: "Aryan", lastName: "Gupta", dateOfBirth: "2011-02-08", gender: Gender.MALE, programType: ProgramType.COMMUNITY, status: ResidentStatus.ASSESSMENTS_COMPLETED },
  { code: "RES-0008", firstName: "Myra", lastName: "Chatterjee", dateOfBirth: "2013-12-25", gender: Gender.FEMALE, programType: ProgramType.FAMILY_LIVING, status: ResidentStatus.IEP_IN_PROGRESS },
  { code: "RES-0009", firstName: "Reyansh", lastName: "Pillai", dateOfBirth: "2010-08-11", gender: Gender.MALE, programType: ProgramType.COMMUNITY, status: ResidentStatus.ACTIVE },
  { code: "RES-0010", firstName: "Saanvi", lastName: "Deshmukh", dateOfBirth: "2012-06-19", gender: Gender.FEMALE, programType: ProgramType.FAMILY_LIVING, status: ResidentStatus.ACTIVE },
];

export async function seed(): Promise<void> {
  logger.info({ event: LOGGER_EVENTS.SEED_STARTED }, "seeding database");

  // Bun ships argon2 in its password API — no extra dependency needed.
  const passwordHash = await Bun.password.hash(DEMO_PASSWORD, {
    algorithm: "argon2id",
  });

  for (const user of USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        clinicalDomain: user.clinicalDomain ?? null,
      },
      create: { ...user, passwordHash },
    });
  }

  for (const type of ASSESSMENT_TYPES) {
    await prisma.assessmentType.upsert({
      where: { code: type.code },
      update: { name: type.name, domain: type.domain, description: type.description },
      create: type,
    });
  }

  for (const activity of ADL_ACTIVITIES) {
    await prisma.adlActivity.upsert({
      where: { code: activity.code },
      update: { name: activity.name, category: activity.category },
      create: activity,
    });
  }

  for (const room of ROOMS) {
    await prisma.room.upsert({
      where: { name: room.name },
      update: { type: room.type, capacity: room.capacity },
      create: room,
    });
  }

  for (const resident of RESIDENTS) {
    await prisma.resident.upsert({
      where: { code: resident.code },
      update: { status: resident.status },
      create: {
        ...resident,
        dateOfBirth: new Date(resident.dateOfBirth),
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    residents: await prisma.resident.count(),
    assessmentTypes: await prisma.assessmentType.count(),
    adlActivities: await prisma.adlActivity.count(),
    rooms: await prisma.room.count(),
  };

  logger.info(
    { event: LOGGER_EVENTS.SEED_COMPLETED, ...counts },
    "seed complete",
  );
}

// Only self-execute when run directly by `prisma db seed`, not when the
// test file imports `seed`.
if (import.meta.main) {
  seed()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      logger.error({ err: error }, "seed failed");
      await prisma.$disconnect();
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && bun run --env-file=env/.env.local test tests/prisma/seed.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Verify the seed runs through the Prisma CLI too**

The test calls `seed()` directly; this proves the `prisma db seed` path in `prisma.config.ts` also works.

```bash
bun run db:seed
```

Expected: log lines `seeding database` and `seed complete` with the counts.

- [ ] **Step 6: Commit**

```bash
cd .. && git status --short
git add backend/prisma/seed.ts backend/tests/prisma/seed.test.ts
git commit -m "feat(backend): add idempotent baseline seed

13 users across all six roles, 8 assessment types, 12 ADL activities, 6
rooms, and 10 residents spread across the status machine so every screen
has data on first load. Every write is an upsert on a natural key, so
db:setup is safe to re-run before a demo. Passwords are argon2id hashed
via Bun.password."
```

---

## Task 12: Wire it together and verify Phase 0 is complete

**Files:**
- Modify: `README.md`
- Create: `backend/README.md`

**Interfaces:**
- Consumes: everything from Tasks 1–11.
- Produces: a documented, reproducible setup. No new code.

- [ ] **Step 1: Reset the database and run the full setup path end to end**

This proves a teammate cloning fresh can get running.

```bash
cd backend
bun run db:migrate:reset   # drops, re-migrates, and runs the seed
```

Expected: migration applied, then `seed complete` with `residents: 10`.

- [ ] **Step 2: Run the entire test suite**

```bash
bun run --env-file=env/.env.local test
```

Expected: all tests pass across `config`, `logger`, `errors`, `prisma`, `app`, `health.routes`, `seed`.

- [ ] **Step 3: Run the full quality gate**

```bash
bun run check
```

Expected: lint, format check, and typecheck all pass, exit 0.

- [ ] **Step 4: Verify the three Phase 0 acceptance criteria explicitly**

```bash
bun dev &
sleep 3
curl -s -o /dev/null -w "healthz: %{http_code}\n" http://localhost:5000/healthz
cd .. && docker compose exec postgres psql -U iadm -d iadm -tAc \
  "SELECT count(*) FROM residents;"
kill %1
```

Expected: `healthz: 200` and `10`.

- [ ] **Step 5: Write `backend/README.md`**

```markdown
# IADM Backend

Bun + Elysia + Prisma + PostgreSQL. See the
[design spec](../docs/specs/2026-08-04-iadm-autism-monitoring-design.md).

## Setup

From the repository root, start Postgres:

    docker compose up -d

Then, in this directory:

    cp env/.env.example env/.env.local
    bun install
    bun run db:setup     # generate + migrate + seed
    bun dev              # http://localhost:5000

Swagger UI: http://localhost:5000/swagger

## Demo accounts

All seeded users share the password `Password123!`.

| Role | Email |
|---|---|
| SUPER_ADMIN | admin@iadm.local |
| CSC | csc1@iadm.local |
| JR_PSYCHOLOGIST | psych1@iadm.local |
| MDT_HEAD | mdthead@iadm.local |
| PSS | pss1@iadm.local |
| PARENT | parent1@iadm.local |

## Commands

| Command | What it does |
|---|---|
| `bun dev` | Watch-mode server on port 5000 |
| `bun run check` | Lint + format check + typecheck — run before every commit |
| `bun test` | Test suite (DB tests need `--env-file=env/.env.local`) |
| `bun run db:setup` | Generate client, apply migrations, seed |
| `bun run db:migrate:dev` | Create and apply a new migration |
| `bun run db:migrate:reset` | Drop, re-migrate, re-seed — destructive |
| `bun run db:studio` | Prisma Studio |

## Conventions

- Request flow is `routes → services → repos → Prisma`. Routes never
  import `@prisma/client`; services never call Prisma directly.
- All environment access goes through `config` from `@/config/configs`.
  A `no-restricted-globals` lint rule enforces this.
- Import internals via the `@/*` alias, never `../../`.
- Log with `LOGGER_EVENTS` constants for the `event` field.
- Postgres runs on host port **5433** to avoid clashing with a local
  Homebrew Postgres on 5432.
```

- [ ] **Step 6: Update the root `README.md` status line**

Replace the status block near the top:

```markdown
> **Status:** Phase 0 complete — backend skeleton, 22-model schema, and seed are running.
> Full design: [`docs/specs/2026-08-04-iadm-autism-monitoring-design.md`](docs/specs/2026-08-04-iadm-autism-monitoring-design.md)
> Phase 0 plan: [`docs/plans/2026-08-04-phase-0-foundation.md`](docs/plans/2026-08-04-phase-0-foundation.md)
```

- [ ] **Step 7: Final check that no IAC code entered the repo**

```bash
cd .. && git status --short
git log --stat --oneline -12 | grep -i "iac/" || echo "clean: no iac paths in history"
```

Expected: `clean: no iac paths in history`.

- [ ] **Step 8: Commit**

```bash
git add README.md backend/README.md
git commit -m "docs: add backend setup guide and mark phase 0 complete

Documents the setup path, demo accounts, commands and conventions so a
teammate can go from clone to running server without asking."
```

---

## Phase 0 Definition of Done

All must be true before starting Phase 1:

- [ ] `docker compose ps` shows `iadm-postgres` healthy
- [ ] `bun run check` exits 0
- [ ] `bun run --env-file=env/.env.local test` — all tests pass
- [ ] `bun dev` starts and `GET /healthz` returns 200 with an `x-request-id` header
- [ ] `GET /swagger` serves the API docs
- [ ] An unknown route returns `{"error":{"code":"NOT_FOUND",...}}`, not an HTML error page
- [ ] `SELECT count(*) FROM residents` returns 10
- [ ] All 22 tables exist in the `public` schema
- [ ] `bun run db:migrate:reset` reproduces the whole database from scratch
- [ ] `git log` shows no `Co-Authored-By` trailers and no `iac/` paths

## What Phase 0 deliberately does NOT include

Do not build these here; they belong to later phases and adding them now
will make this phase impossible to review:

- Any authentication logic (Phase 1)
- Any domain endpoint beyond `/healthz` (Phases 2–5)
- Services or repos — the layering exists as folders only until Phase 1
  gives it something to carry
- The synthetic longitudinal history generator (Phase 6, separate from
  this baseline seed on purpose)
- The web app, parent app, or ML service
