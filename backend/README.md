# IADM Backend

Bun + Elysia + Prisma + PostgreSQL. See the
[design spec](../docs/specs/2026-08-04-iadm-autism-monitoring-design.md).

## Setup

One-time database setup (local PostgreSQL 15+ must be running). `CREATEDB`
is needed because `prisma migrate dev` creates a temporary shadow database:

    psql -d postgres -c "CREATE ROLE iadm LOGIN CREATEDB PASSWORD 'iadm_dev_password';"
    createdb -O iadm iadm

Then, in this directory:

    cp env/.env.example env/.env.local
    bun install
    bun run db:setup     # generate + migrate + seed
    bun dev              # http://localhost:5000

Swagger UI: http://localhost:5000/swagger

## Demo accounts

All seeded users share the password `Password123!`. All data is synthetic.

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
| `bun run test` | Test suite. Use this, not bare `bun test` — it loads `env/.env.local`, without which config refuses to start |
| `bun run db:setup` | Generate client, apply migrations, seed |
| `bun run db:migrate:dev` | Create and apply a new migration |
| `bun run db:seed` | Re-run the seed (safe — every write is an upsert) |
| `bun run db:migrate:reset` | Drop, re-migrate, re-seed — **destructive** |
| `bun run db:studio` | Prisma Studio |

## Conventions

- Request flow is `routes → services → repos → Prisma`. Routes never
  import `@prisma/client`; services never call Prisma directly.
- All environment access goes through `config` from `@/config/configs`.
  A `no-restricted-properties` lint rule enforces this; `prisma.config.ts`
  is the one other exemption, because the Prisma CLI runs outside the app.
- Import internals via the `@/*` alias, never `../../`.
- Log with `LOGGER_EVENTS` constants for the `event` field.
- Postgres is the machine's local PostgreSQL 17 on port **5432**.
  Containerising it was deferred — see Task 1 of the Phase 0 plan.

## Gotchas

- **Prisma 7 connects through `@prisma/adapter-pg`.** The pg driver ignores
  the `?schema=` URL parameter, so `src/adapters/database/prisma.ts` reads it
  and passes it on. Pointing `DATABASE_URL` at a throwaway schema therefore
  really does isolate a run from `public`.
- **The initial migration has one hand-written index**,
  `uq_staff_assignment_active` (one active assignment per resident, user and
  role). Prisma cannot express a partial index in the schema, but leaves it
  alone on later migrations.
- **`prisma migrate reset` no longer seeds** in Prisma 7; the
  `db:migrate:reset` script chains `db:seed` after it.
