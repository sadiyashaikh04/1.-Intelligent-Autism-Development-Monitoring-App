# Demo Frontend Slice — Design

**Date:** 2026-10-15 · **Status:** approved in conversation, pending written review
**Parent spec:** [`2026-08-04-iadm-autism-monitoring-design.md`](2026-08-04-iadm-autism-monitoring-design.md)

## 1. Why this exists

A submission on 2026-10-16 needs something visible. Phase 0 delivered a running backend with a seeded database but no screens. This slice reorders the roadmap: a read-only web frontend over real data is built **before** Phase 1 (auth). It is a deviation from §10 of the parent spec, recorded here so it is a decision, not drift.

**Success:** on a laptop, an examiner opens `http://localhost:3000`, signs in on a visual login with a seeded email, browses the 10 seeded Service Users with live data from Postgres, opens one to see its profile, status history and care team, and views the three catalogues. Every screen survives a 360px-wide viewport.

## 2. Scope

**In:**

- Four read-only backend endpoints (§3) plus a seed addition for care teams and parent links.
- A new `web/` subproject (§4): visual login, protected shell, Service User list + detail, Catalogues.

**Out (unchanged in the roadmap, not cut):** real authentication and role enforcement (Phase 1), the dashboard, every create/edit/approve flow, notifications, insights.

## 3. Backend additions

Layering follows the parent spec §2.1 exactly: `routes → services → repos → Prisma`; services are singletons via `getInstance()`; repos are the only Prisma importers; response shapes are Zod schemas in `repos/schemas/`.

| Endpoint | Response `data` |
|---|---|
| `GET /residents?q&status&page&limit` | Array of `{ id, code, firstName, lastName, dateOfBirth, gender, programType, status, admissionDate }`; `meta: { page, limit, total }`. `q` matches code, first or last name, case-insensitive. `limit` default 20, max 100. Soft-deleted residents excluded. |
| `GET /residents/:id` | The list fields plus `statusHistory` (newest first: `fromStatus, toStatus, reason, createdAt, changedBy {firstName,lastName}`), `careTeam` (active assignments: `role, assignedAt, user {firstName,lastName,email}`), `parents` (`relationship, parent {firstName,lastName,email}`). Unknown or malformed id → 404 `RESIDENT_NOT_FOUND`. |
| `GET /assessments/types` | Active, non-deleted assessment types, ordered by domain then name. |
| `GET /adl/activities` | Active, non-deleted ADL activities, ordered by category then name. |
| `GET /calendar/rooms` | Active, non-deleted rooms, ordered by name. |

Invalid query params (e.g. `status=BOGUS`, `limit=0`) → 400 `VALIDATION_FAILED` in the standard error envelope.

**No authentication yet.** Each route file carries a comment marking where Phase 1's auth guard goes. Acceptable only because the backend runs on a developer laptop; these routes must gain the guard before anything is deployed.

**Seed addition.** Care-team assignments consistent with each resident's status: residents at `CSC_ASSIGNED` or later get a CSC; at `MDT_ASSIGNED` or later also a JR_PSYCHOLOGIST, the MDT_HEAD and one PSS. Both `ACTIVE` residents, plus `IEP_IN_PROGRESS` and `ASSESSMENTS_COMPLETED`, get a linked parent (4 parents, 4 links). Idempotent like the rest of the seed.

## 4. Web subproject

`web/` — Next.js 16 (App Router, `src/`), React 19, Tailwind 4, TypeScript strict, Zustand, bun. Port 3000. Backend reached via `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:5000`).

**Branding is our own.** Name "IADM", our own palette (indigo primary, neutral greys, status chip colours per journey phase) defined once in `src/config/theme.ts` and exposed as Tailwind theme tokens. No IAC logo, name or brand colours.

```
web/src/
├── app/
│   ├── layout.tsx               # fonts, globals
│   ├── page.tsx                 # → redirect to /service-user
│   ├── (public)/login/page.tsx
│   └── (protected)/
│       ├── layout.tsx           # DemoAuthGuard + AppShell
│       ├── service-user/page.tsx
│       ├── service-user/[id]/page.tsx
│       └── catalogues/page.tsx
├── components/
│   ├── ui/                      # Button, Input, Card, StatusChip, Tabs, Table, EmptyState, ErrorState, Spinner
│   └── layout/                  # AppShell, Header, SideNav
├── stores/demo-auth-store.ts    # Zustand, sessionStorage-persisted demo user
├── lib/api-client.ts            # typed api.get, ApiError, standard envelope
├── lib/format.ts                # age from DOB, dates, enum → label
└── config/theme.ts
```

**Login (visual).** Centred card: email, password, Sign in. Any of the 13 seeded emails signs in (checked against a static list in the web app — no backend call); the password is not checked. Stores `{ email, name, role }` in the demo store. A visible note: *"Demo mode — real authentication arrives in Phase 1."* Unknown email → inline error.

**Shell.** Header with app name and the demo user's name + role and a Sign out. Side nav: Service Users, Catalogues; Assessments, IEP Plans, ADL Tracking, Incidents, Insights shown disabled with a "Soon" tag. Below `md` the side nav collapses behind a menu button.

**Service Users.** Search box (debounced) and status `<select>` drive the query string. Desktop: table (Code, Name, Age, Gender, Programme, Status chip, Admission). Below `md`: cards. Pagination controls when `total > limit`. Row/card links to detail.

**Detail.** Header: name, code, status chip, age, programme. Tabs: Overview (profile fields), Status history (vertical timeline), Care team (role + name + email; parents listed separately). Empty tab content shows an explanatory empty state, never a blank area.

**Catalogues.** Tabs: Assessment types (name, code, domain, description), ADL activities (name, code, category), Rooms (name, type, capacity).

**States.** Every data view renders loading, empty, and error. When the backend is unreachable the error state says *"Backend not reachable — start it with `bun dev` in `backend/`."*

## 5. Testing

- Backend: Bun route tests via `app.handle` against the seeded database, written first, covering each endpoint's happy path, filters, pagination meta, 404, and 400 on bad params; seed tests extended for care teams and parent links.
- Web: no automated tests (parent spec §9.3). Gates are `bun run lint` and `bun run build` passing, plus a manual checklist: each screen at 1280px and 360px, search, filter, detail tabs, sign out, and backend-down error state.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Unauthenticated endpoints outlive the demo | Phase 1 plan's first task adds the guard; each route file has a marker comment |
| Visual login mistaken for real security | The demo-mode note on the login page; the report says so |
| Time runs out | Build order: backend → shell + login → residents → catalogues. Catalogues is the cut |
