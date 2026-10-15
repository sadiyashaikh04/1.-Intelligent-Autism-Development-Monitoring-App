# Demo Frontend (All Roles, Sample Data) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js web app in `web/` where each of the six roles signs in via a quick-pick login and uses its own pages and headline workflow actions on in-browser sample data.

**Architecture:** Pure, unit-tested domain functions (`src/lib/domain/`) operate on one typed in-memory database object (`DemoDb`). A Zustand store holds that object; `src/lib/data-source.ts` is the only module pages import for data — it exposes React hooks for reads and a `useActions()` hook for mutations, both bound to the signed-in demo user. Later phases replace data-source internals with backend calls; pages do not change.

**Tech Stack:** Next.js 16.4 (App Router, `src/`), React 19, Tailwind CSS 4.3, TypeScript strict, Zustand 5, Recharts 3, bun 1.3.

**Spec:** [`docs/specs/2026-10-15-demo-frontend-design.md`](../specs/2026-10-15-demo-frontend-design.md) (parent: [`2026-08-04-iadm-autism-monitoring-design.md`](../specs/2026-08-04-iadm-autism-monitoring-design.md))

> **Ruling, 2026-10-15 — deadline format.** Shared contracts (types, permissions, transitions, data-source signatures) are specified exactly below. Page tasks give exact requirements and acceptance checks rather than full JSX, because writing every page twice does not fit a one-day deadline. Cost if wrong: an executor must design page markup; mitigated by the acceptance checklist per task.

> **Ruling, 2026-10-15 — tests.** The spec says no automated web tests. The *domain logic* (permissions, transitions, mutations) gets `bun test` unit tests anyway: it encodes the parent spec's rules, it is pure, and it is where a demo-day bug would be most embarrassing. Pages remain manually verified.

## Global Constraints

- All work under `web/`. No change to `backend/`.
- Field names and enum values match `backend/prisma/schema.prisma` exactly (string unions, e.g. `"IN_PROGRESS_GOAL"`).
- Dates in sample data are ISO strings; "today" is computed at runtime so the demo always looks current.
- Branding: name "IADM"; indigo primary; tokens only in `src/config/theme.ts` + `globals.css`. No IAC logo, name or colours.
- Every page shows the banner: `Demo — sample data, not connected to the database.`
- Insights pages state the data is synthetic and the model only flags, never acts.
- Mobile-first (360px, 44px targets, native `<select>`, sticky submit, defaults to today + current shift) for ADL logging and Report incident.
- Path alias `@/*` → `src/*`. No `../../` imports.
- Commits: identity `sadiyashaikh04`, **no Co-Authored-By trailer**; never commit anything from `iac/`.
- Every task ends with `bun run lint`, `bun run test`, `bun run build` all passing in `web/`, then a commit.

## Review Focus

1. **Wrong role reaching a page by URL** — typing `/user-management` as PSS must show "You don't have access to this page", not the page. → Task 2 guard + `canAccessRoute` test.
2. **Scoping leaks** — PSS / JR_PSYCHOLOGIST see only assigned residents; PARENT only their child, including via `/service-user/<other-id>`. → Task 1 `listResidents`/`getResidentDetail` tests.
3. **Illegal transitions** — buttons only offer allow-listed next statuses; the mutation itself also rejects illegal ones (e.g. `IMPORTED → ACTIVE`). → Task 1 transitions tests.
4. **Duplicate ADL log** — same assignment + date + shift twice must be rejected with a visible message (parent spec §5.3). → Task 1 `createAdlLog` test.
5. **Hydration mismatch / refresh** — refreshing any protected page keeps the user signed in (sessionStorage) and never flashes another role's menu. → Task 2 guard waits for store hydration.

---

## File Structure

| Path | Responsibility |
|---|---|
| `web/src/data/types.ts` | Enum unions + record types mirroring Prisma |
| `web/src/data/seed/*.ts` | Sample records per domain; `buildDemoDb(today: Date): DemoDb` in `seed/index.ts` |
| `web/src/lib/domain/permissions.ts` | Role → nav, route access, tabs, actions |
| `web/src/lib/domain/transitions.ts` | Resident / assessment / IEP / incident allow-lists |
| `web/src/lib/domain/queries.ts` | Pure read functions `(db, viewer, args)` |
| `web/src/lib/domain/mutations.ts` | Pure mutations `(db, viewer, args) → { db, error? }` |
| `web/src/lib/domain/labels.ts` | Enum → human label, status chip colour key |
| `web/src/lib/format.ts` | Dates, age |
| `web/src/stores/demo-auth-store.ts` | Signed-in demo user (persisted, sessionStorage) |
| `web/src/stores/demo-data-store.ts` | `DemoDb` + `run(mutation)` |
| `web/src/lib/data-source.ts` | Hooks: `useViewer`, `useQuery`, `useActions` — the only data import for pages |
| `web/src/components/ui/*` | Primitives |
| `web/src/components/layout/*` | AppShell, Header, SideNav, DemoBanner, RouteGuard |
| `web/src/app/**` | Pages |
| `web/tests/domain/*.test.ts` | Domain unit tests |

---

## Task 1: Scaffold, theme, types, sample data, domain logic, stores

**Files:** create everything under `web/` listed above except pages and layout components.

**Interfaces — Produces:**

```ts
// data/types.ts (excerpt — every Prisma enum gets a union)
export type UserRole = "SUPER_ADMIN" | "CSC" | "JR_PSYCHOLOGIST" | "MDT_HEAD" | "PSS" | "PARENT";
export type ResidentStatus = "IMPORTED" | "ENROLLED" | "CSC_ASSIGNED" | "MDT_ASSIGNED" | "ASSESSMENTS_SCHEDULED" | "ASSESSMENTS_IN_PROGRESS" | "ASSESSMENTS_COMPLETED" | "IEP_IN_PROGRESS" | "IEP_APPROVED" | "ACTIVE" | "INACTIVE";
export interface DemoDb {
  users: User[]; residents: Resident[]; statusHistory: StatusHistoryEntry[];
  staffAssignments: StaffAssignment[]; residentParents: ResidentParent[];
  assessmentTypes: AssessmentType[]; assessments: Assessment[];
  iepPlans: IepPlan[]; iepGoals: IepGoal[]; goalProgressLogs: GoalProgressLog[];
  adlActivities: AdlActivity[]; adlAssignments: AdlAssignment[]; adlLogs: AdlLog[];
  rooms: Room[]; calendarSlots: CalendarSlot[]; incidents: Incident[];
  notifications: Notification[]; developmentSnapshots: DevelopmentSnapshot[];
  riskAssessments: RiskAssessment[];
}
export type Viewer = Pick<User, "id" | "role" | "firstName" | "lastName" | "email">;

// domain/mutations.ts
export type MutationResult = { db: DemoDb; error?: string };
export type Mutation<A> = (db: DemoDb, viewer: Viewer, args: A) => MutationResult;

// domain/permissions.ts
export type NavKey = "dashboard" | "service-user" | "assessment" | "iep" | "adl-tracking" | "calendar" | "incidents" | "insights" | "notifications" | "user-management" | "catalogues" | "my-child";
export function navFor(role: UserRole): Array<{ key: NavKey; label: string; href: string }>;
export function canAccessRoute(role: UserRole, pathname: string): boolean;
export function detailTabsFor(role: UserRole): DetailTab[]; // "overview"|"history"|"care-team"|"assessments"|"iep"|"adl"|"development"
export function can(role: UserRole, action: Action): boolean; // Action = "resident.advance" | "assessment.schedule" | "assessment.conduct" | "assessment.review" | "iep.author" | "iep.review" | "adl.log" | "adl.review" | "goal.log" | "incident.report" | "incident.review" | "incident.close" | "user.manage" | "insights.risk"

// stores/demo-data-store.ts
export const useDemoData: UseBoundStore<{ db: DemoDb; run: <A>(m: Mutation<A>, viewer: Viewer, args: A) => string | undefined; reset: () => void }>;
```

Mutations in Task 1 (all append status history / notifications per parent spec §5): `advanceResidentStatus`, `scheduleAssessment`, `startAssessment`, `submitAssessment`, `reviewAssessment`, `createIepPlan`, `addIepGoal`, `submitIepPlan`, `reviewIepGoal`, `createAdlLog`, `reviewAdlLog`, `logGoalProgress`, `reportIncident`, `reviewIncident`, `closeIncident`, `markNotificationRead`, `markAllNotificationsRead`, `createUser`, `setUserActive`. Each checks `can(viewer.role, …)` and scoping first and returns `{ db, error }` unchanged on refusal.

Queries in Task 1: `listResidents(db, viewer, { q?, status? })`, `getResidentDetail(db, viewer, id)`, `listAssessments(db, viewer)`, `listIepPlans(db, viewer)`, `getIepPlan(db, viewer, id)`, `listPssAssignments(db, viewer)`, `listAdlLogs(db, viewer, { residentId?, approvalStatus? })`, `listIncidents(db, viewer)`, `listCalendarSlots(db, viewer, weekStart)`, `listNotifications(db, viewer)`, `unreadCount(db, viewer)`, `getDevelopment(db, viewer, residentId)`, `listDeclineFlags(db, viewer)`, `listRiskBoard(db, viewer)`, `dashboardFor(db, viewer)`.

- [ ] **Step 1:** Scaffold: `bunx create-next-app@16.4.1 web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun --no-turbopack --yes`; add `zustand`, `recharts`; add `"test": "bun test"`; delete boilerplate page content; set `<title>IADM</title>`.
- [ ] **Step 2:** Write `tests/domain/permissions.test.ts`, `transitions.test.ts`, `queries.test.ts`, `mutations.test.ts` covering: each role's nav keys; `canAccessRoute("PSS","/user-management") === false`; `IMPORTED → ENROLLED` allowed, `IMPORTED → ACTIVE` refused; PSS `listResidents` returns only assigned; PARENT `getResidentDetail` of a non-child returns `null`; duplicate `createAdlLog` returns an error; `reviewIepGoal` reject without reason errors; plan becomes `APPROVED_IEP` once all goals decided with ≥1 approved, `REJECTED_IEP` when all rejected; `reportIncident` notifies care team and (if `notifyParent`) the parent; `reviewIncident` escalate sets severity `CRITICAL_INTERRUPT`.
- [ ] **Step 3:** Run `bun run test` — Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement `types.ts`, `seed/*`, `domain/*`, `format.ts`, stores, `data-source.ts`.
- [ ] **Step 5:** `bun run test` → PASS; `bun run lint && bun run build` → pass.
- [ ] **Step 6:** Commit `feat(web): scaffold next app with sample data and domain logic`.

## Task 2: Login, shell, navigation, guard, notifications bell

- Login `/login`: centred card, IADM wordmark, 6 role quick-pick buttons (name + role), email field accepting any seeded email, password field (not checked), note "Demo mode — real authentication arrives in Phase 1." Unknown email → inline error. Inactive user → "This account is deactivated".
- `(protected)/layout.tsx`: waits for auth-store hydration; no user → redirect `/login`; `canAccessRoute` false → in-shell "You don't have access to this page" with link to dashboard.
- AppShell: Header (wordmark, bell with unread count → `/notifications`, user name + role label, Sign out), SideNav from `navFor(role)` with active state, collapses behind a menu button below `md`; DemoBanner on top.
- `/` redirects to `/dashboard` (or `/my-child` for PARENT) when signed in, else `/login`.
- **Checks:** each role signs in and sees only its nav; refresh keeps session; PSS typing `/user-management` sees the no-access message; 360px layout has no horizontal scroll.
- Commit `feat(web): add demo login, role-based shell and route guard`.

## Task 3: Service Users list + detail

- List: search (code/name), status select, table ≥ md, cards < md, status chip, age, programme, row → detail. Title "My Service Users" for PSS/JR_PSYCHOLOGIST.
- Detail: header (name, code, chip, age, programme, admission); tabs from `detailTabsFor(role)`: Overview, History (timeline), Care team (+ parents), Assessments, IEP (goals + progress), ADL (recent logs), Development (trajectory mini-chart; Task 8 fills). CSC sees "Advance status" with allow-listed next statuses + reason → `advanceResidentStatus`.
- Not found / out of scope → "Service user not found".
- **Checks:** PSS sees only assigned; CSC advances `IMPORTED → ENROLLED` and history shows it; parent id URL of other child → not found.
- Commit `feat(web): add service user list and detail`.

## Task 4: PSS — ADL logging, goal progress, report incident (mobile-first)

- `/adl-tracking` for PSS: resident select (assigned only), date defaults today, shift defaults by clock (06–14 MORNING, 14–22 EVENING, else NIGHT); per assignment: status segmented buttons (TODO / IN_PROGRESS / DONE), prompt level select, mood buttons (CALM/ANXIOUS/ESCALATED/MELTDOWN), notes; sticky "Submit log"; duplicate → inline error; success toast. Below: "Today's logs" with approval status.
- Goal progress: on the resident's IEP tab and on Today page — outcome + prompt level + notes → `logGoalProgress`.
- `/incidents/new`: type, severity, occurred-at (defaults now), location, description, notify-parent toggle; sticky submit → `reportIncident` → redirect to `/incidents/<id>`.
- **Checks:** at 360×640 every control ≥ 44px, no horizontal scroll, open → tap status → tap mood → submit works without the date picker.
- Commit `feat(web): add mobile-first ADL logging and incident reporting`.

## Task 5: Assessments + IEP

- `/assessment`: CSC — table of residents needing assessments + "Schedule" (type, clinician, room, datetime) → `scheduleAssessment` (creates calendar slot + notification). JR_PSYCHOLOGIST — "My assessments" queue; `/assessment/[id]` → Start → findings form (3–5 rated items per type, 1–5 scale, summary notes) → Submit. MDT_HEAD — "Awaiting review" list; detail shows findings → Approve / Request revision (notes required).
- `/iep`: JR_PSYCHOLOGIST — plans list + "Create plan" for `ASSESSMENTS_COMPLETED` residents; `/iep/[id]` builder: add goal (domain, title, description, frequency, target, assigned role), Submit plan. MDT_HEAD — goals pending approval grouped by plan; Approve / Reject (reason required). CSC — approved plans → "Activate" (resident → ACTIVE).
- **Checks:** full workflow 5.2 on one resident across three roles by signing out/in; statuses and notifications update.
- Commit `feat(web): add assessment and IEP workflows`.

## Task 6: Role dashboards

- `dashboardFor` drives cards per role: SUPER_ADMIN (users by role, residents by status, open incidents); CSC (residents by status, pending ADL approvals, assessments to schedule, open incidents); JR_PSYCHOLOGIST (my assessments by status, plans in draft, my residents); MDT_HEAD (awaiting review, goals pending, escalated incidents, high-risk count); PSS "Today" (today's ADL progress per resident, sessions today, report-incident shortcut).
- Each card links to the relevant page. Residents-by-status as a horizontal bar list (no chart library needed).
- Commit `feat(web): add role dashboards`.

## Task 7: Incidents, ADL approval queue, calendar, notifications

- `/incidents`: list with status/type filters (PSS: own reports + assigned residents). `/incidents/[id]`: details + timeline; MDT_HEAD Start review / Escalate / Resolve (resolution required); CSC Close.
- `/adl-tracking` for CSC: pending-approval queue → Approve / Reject (reason) → `reviewAdlLog`.
- `/calendar`: week view (Mon–Sun columns ≥ md, day list < md), prev/next week, slot chips coloured by type; staff see own slots, CSC/ADMIN all.
- `/notifications`: list, unread emphasis, mark one / all read; bell count updates live.
- Commit `feat(web): add incidents, ADL approvals, calendar and notifications`.

## Task 8: Insights

- `/insights`: banner "Synthetic data — the model only flags; a clinician decides." Decline flags list; risk board (MDT_HEAD, CSC, ADMIN, JR_PSYCH scoped; never PSS/PARENT) with band chip, score, and plain-language top factors.
- Resident Development tab: Recharts line chart of `independenceIndex` per domain over 8+ weeks, trajectory chips, "last computed" timestamp.
- Commit `feat(web): add insights trajectories and risk board`.

## Task 9: Parent view

- `/my-child`: child switcher if >1 child; profile, status in plain words, care team names; Progress section: goal progress bars, ADL completion this week, trajectory sentences ("steady progress in communication over the last month"); never a risk score. Notifications reachable from header.
- Commit `feat(web): add parent web view`.

## Task 10: User management + catalogues; final pass

- `/user-management` (SUPER_ADMIN RW, CSC/MDT_HEAD read-only): table, role filter, "Add user" form, deactivate/reactivate.
- `/catalogues`: tabs for assessment types, ADL activities, rooms.
- `web/README.md`: setup (`bun install`, `bun dev`), demo accounts, the sample-data disclaimer, and the note that real wiring resumes in Phase 1.
- Root `README.md`: add `web/` status line.
- Final manual pass: every role, every nav item, at 1280px and 360px.
- Commit `feat(web): add user management, catalogues and demo readme`.
