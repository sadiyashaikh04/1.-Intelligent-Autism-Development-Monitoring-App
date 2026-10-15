# Demo Frontend (All Roles, Sample Data) — Design

**Date:** 2026-10-15 · **Status:** approved in conversation
**Parent spec:** [`2026-08-04-iadm-autism-monitoring-design.md`](2026-08-04-iadm-autism-monitoring-design.md)

## 1. Why this exists — an emergency detour

A submission on 2026-10-16 needs something visible. Phase 0 delivered a running backend but no screens. This slice builds the **whole web frontend for all six roles on in-browser sample data**, before Phase 1.

**This is a temporary detour, not a new roadmap.** After the submission, work resumes at Phase 1 of the parent spec §10 exactly as planned. The frontend built here is then progressively wired to real endpoints phase by phase — which is cheap because every page reads and writes through one data-source module (§3).

**Success:** on a laptop, an examiner opens `http://localhost:3000`, picks any of the six roles on the login page, and sees that role's own menu and pages, can perform the headline actions of the four workflows (parent spec §5) on sample data, and every screen survives a 360px-wide viewport.

## 2. Scope

**In:** a new `web/` subproject — login with role quick-pick, role-based shell and navigation, every page in parent spec §2.2 plus a web parent view, key workflow actions working in memory.

**Out:** any backend change, real authentication, persistence (changes reset on refresh), the Expo parent app, automated web tests.

## 3. Architecture

`web/` — Next.js 16 (App Router, `src/`), React 19, Tailwind 4, TypeScript strict, Zustand, Recharts (insights charts), bun. Port 3000.

```
web/src/
├── app/
│   ├── (public)/login/
│   └── (protected)/            # DemoAuthGuard + AppShell
│       ├── dashboard/          # role-specific dashboard
│       ├── service-user/  [id]/
│       ├── assessment/  [id]/
│       ├── iep/  [id]/
│       ├── adl-tracking/       # PSS logging (mobile-first) · CSC approval queue
│       ├── calendar/
│       ├── incidents/  new/  [id]/
│       ├── insights/
│       ├── notifications/
│       ├── user-management/
│       ├── catalogues/
│       └── my-child/           # PARENT web view
├── components/ui/  components/layout/  components/<domain>/
├── data/                       # typed sample dataset (synthetic)
├── stores/                     # demo-auth-store, demo-data-store (Zustand)
├── lib/data-source.ts          # the ONLY thing pages call for data
├── lib/permissions.ts          # role → nav items, visible tabs, allowed actions
└── config/theme.ts
```

**Sample data.** `src/data/` holds typed records whose field names and enum values match `backend/prisma/schema.prisma` exactly (the 13 users and 10 residents mirror the backend seed). Added on top: care teams, parent links, assessments in every status, IEP plans and goals, ~4 weeks of ADL and goal-progress logs, incidents in every status, calendar slots for the current week, notifications per user, and per-resident development trajectories and risk flags with top factors. All synthetic.

**Data source.** `lib/data-source.ts` exposes React hooks for reads (`useQuery(listResidents, { q })`, …) and a `useActions()` hook for mutations (`submitAssessment`, `reviewIepGoal`, `createAdlLog`, …), backed by pure, unit-tested domain functions over the in-memory Zustand store. Hooks keep every view live (e.g. the notification bell updates the moment an action fires). Pages never touch `src/data/` or the store directly. In later phases the hook internals are replaced by `api-client` calls; page code stays.

**Permissions.** `lib/permissions.ts` encodes parent spec §3.1: nav items per role, detail-page tabs per role, and which action buttons render. Scoping is applied in the data source: PSS and JR_PSYCHOLOGIST see only residents they are assigned to; PARENT sees only their linked child.

**Branding.** Our own: name "IADM", indigo primary, neutral greys, status-chip colours per journey phase, all in `config/theme.ts`. No IAC logo, name or colours.

**Honesty markers.** A thin banner on every page: *"Demo — sample data, not connected to the database."* Insights pages also state the data is synthetic and that the model only flags, never acts. The login page says real authentication arrives in Phase 1.

## 4. Roles, pages and actions

| Role | Pages | Working actions |
|---|---|---|
| SUPER_ADMIN | Dashboard, Service Users, User management, Catalogues, Calendar, Incidents, Insights, Notifications | Add user, deactivate user |
| CSC | Dashboard, Service Users + detail, Assessments (schedule), ADL approval queue, Calendar, Incidents, Insights, Notifications | Advance resident status (allow-listed transitions only), approve/reject ADL log, close incident |
| JR_PSYCHOLOGIST | Dashboard, My Service Users, My Assessments, IEP builder, Calendar, Insights, Notifications | Start + submit assessment findings, add goals, submit IEP plan |
| MDT_HEAD | Dashboard, Service Users, Assessment reviews, IEP goal approvals, Incidents review, Insights + risk board, Notifications | Approve / request revision on assessment, approve / reject each goal (reason required), review → escalate or resolve incident |
| PSS | Today, My Service Users, ADL logging, Report incident, Calendar, Notifications | Log ADL entry, log goal progress, report incident |
| PARENT | My Child, Progress, Notifications | None (read-only) |

All roles: notification bell with unread count; mark one / all as read. Every action that changes state also appends a status-history entry where the parent spec requires one, and creates the notification the parent spec §5 names.

**Mobile-first screens** (parent spec §2.3, binding): ADL logging and Report incident — single column at 360px, 44px targets, defaults to today + current shift, native selects, sticky submit.

**Service User detail tabs:** Overview, History, Care team, Assessments, IEP, ADL, Development — filtered per role by `permissions.ts`.

## 5. Build order and cut line

1. Scaffold, theme, UI primitives, sample data, stores, data source, permissions
2. Login, shell, navigation, notifications bell
3. Service Users list + detail
4. PSS: ADL logging, goal progress, report incident
5. Assessments (schedule, conduct, review) and IEP (builder, goal approval)
6. Role dashboards
7. Incidents list/review, Calendar, Notifications page
8. Insights
9. Parent view
10. User management, Catalogues

Cut from the bottom if time runs out; items 1–5 alone demonstrate the core workflows.

## 6. Testing

No automated web tests (parent spec §9.3). Gates: `bun run lint` and `bun run build` pass after each task; a manual checklist per role at 1280px and 360px covering navigation, each working action, and the honesty banner.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Sample data mistaken for a working system | Banner on every page; demo script says it |
| Detour becomes the plan | §1 states the return to Phase 1; data-source seam makes rewiring incremental |
| Scope too big for one day | Build order + cut line in §5 |
