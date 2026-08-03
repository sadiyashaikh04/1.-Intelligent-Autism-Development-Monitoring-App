# Intelligent Autism Development Monitoring App (IADM)

**Design spec** · 2026-08-04
**Status:** approved, ready for implementation planning
**Repository:** `github.com/sadiyashaikh04/1.-Intelligent-Autism-Development-Monitoring-App` (monorepo)

A scaled-down reimplementation of the IAC Clinical Care Suite, built as a college major project, with a development-monitoring intelligence layer on top. Same domain, same architecture, same stack as IAC — roughly one-fifth the surface area, plus an ML service IAC does not have.

---

## 1. Goal and constraints

**Goal.** Build a working multi-role clinical care management system for autism development monitoring: staff record structured daily observations against individualised goals, and an intelligence layer turns that longitudinal record into development trajectories, early-decline alerts, and incident-risk flags for clinicians to act on.

**Staff use the web app, including on phones.** There is no PSS mobile app. Support staff log ADL entries and report incidents through the web app on a handset browser, so the ADL logging and incident forms are designed mobile-first — thumb-reachable controls, single-column layout, no horizontal scrolling, works at 360px wide. This is a functional requirement, not a styling preference.

**Constraints.**

| Constraint | Value |
|---|---|
| Team | 2–4 people |
| Duration | 2–3 months |
| Working style | Step-by-step, phase by phase, reviewed as we go |
| Infra depth | Balanced — Docker Compose, migrations, seed, Swagger, logging, tests on critical services. No CI, no cloud deploy. |
| Repo | Single monorepo under the `sadiyashaikh04` account |

**Success criteria.**

1. All four workflows (§5) run end to end against seeded data, with role restrictions actually enforced.
2. Every state transition is written to `ResidentStatusHistory` and `AuditLog`.
3. A PSS can complete a full ADL log on a 360px-wide phone browser without zooming or horizontal scrolling.
4. The ML service produces a per-domain development trajectory and an incident-risk band for every active resident, and a clinician can see *why* it said that.
5. The incident-risk model is evaluated on a held-out time period with ROC-AUC, precision, and recall reported — and the report states plainly that the training data is synthetic.
6. The parent app shows a child's goal progress and notifications, refreshed from live backend data.
7. `bun run check` passes and workflow-service tests are green.
8. A scripted 10-minute demo covers all four workflows plus the intelligence layer without touching the database by hand.

**Explicit non-goals.** A PSS mobile app, offline sync, push notifications, PII masking, read/write pool splitting, OpenTelemetry, Salesforce/GCS/CloudFront/Redis adapters, cloud deployment, CI pipelines, report/PDF export, deep learning, real patient data, any claim of clinical validity.

---

## 2. Repository layout

One monorepo. IAC splits into three repos for deployment reasons that don't apply here; a single repo gives the team one history and the submission one URL.

```
1.-Intelligent-Autism-Development-Monitoring-App/
├── backend/                # Bun + Elysia + Prisma + PostgreSQL 16   :5000
├── web/                    # Next.js 16 + React 19 + Tailwind 4      :3000
├── parent-mobile/          # Expo + Expo Router + NativeWind
├── ml-service/             # Python 3.12 + FastAPI + scikit-learn    :8000
├── docs/
│   ├── specs/              # this file
│   └── diagrams/           # ER diagram, architecture diagram
├── docker-compose.yml      # postgres + ml-service
├── .gitignore
└── README.md
```

Each subproject keeps its own lockfile and lifecycle — there is no workspace tool tying them together. `cd` into one before running anything.

`web` reaches the backend via `NEXT_PUBLIC_API_BASE_URL`; `parent-mobile` via `EXPO_PUBLIC_API_BASE_URL`; `backend` reaches the ML service via `ML_SERVICE_BASE_URL`.

> **The `iac/` reference folder is never committed.** It contains proprietary client code and sits outside this repo entirely. Verify with `git status` before the first push.

### 2.1 Backend structure

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   ├── seed.ts                 # baseline demo data
│   └── generate-history.ts     # synthetic longitudinal data for ML (§9.2)
├── src/
│   ├── app.ts                  # Elysia instance: plugins, CORS, swagger, request-id, error handler
│   ├── index.ts
│   ├── config/configs.ts       # single Zod-validated config — the ONLY place env is read
│   ├── routes/
│   │   ├── index.ts            # mounts every route group with its prefix
│   │   ├── health.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── resident.routes.ts
│   │   ├── assessment.routes.ts
│   │   ├── iep.routes.ts
│   │   ├── adl.routes.ts
│   │   ├── calendar.routes.ts
│   │   ├── incident.routes.ts
│   │   ├── notification.routes.ts
│   │   ├── insight.routes.ts   # trajectories + risk, read from persisted results
│   │   └── dashboard.routes.ts
│   ├── services/               # business rules, transitions, permission checks
│   ├── repos/                  # the ONLY place Prisma is touched
│   │   ├── *.repo.ts
│   │   └── schemas/            # Zod request/response schemas per domain
│   ├── jobs/
│   │   └── nightly-insights.job.ts   # calls ml-service, persists snapshots + risk
│   ├── common/
│   │   ├── base.service.ts
│   │   ├── middleware/auth.middleware.ts
│   │   ├── authorization.ts    # role → permission mapping
│   │   ├── permissions.ts
│   │   ├── errors.ts           # AppError hierarchy → HTTP status mapping
│   │   ├── logger.ts           # Pino + request-id context
│   │   └── loggerEvents.ts
│   └── adapters/
│       ├── database/           # Prisma client factory
│       └── ml/                 # typed HTTP client for ml-service
├── tests/
└── env/.env.local
```

**Rules, carried over from IAC:**

- Request flow is strictly `routes → services → repos → Prisma`. Routes never import `@prisma/client`. Services never call Prisma directly.
- Services are singletons obtained via `getInstance()` at the top of each routes file.
- All env access goes through `config` from `src/config/configs.ts`. Never read `Bun.env` / `process.env` elsewhere.
- Path alias `@/*` → `src/*` for all internal imports.
- Log with `LOGGER_EVENTS` constants for the `event` field, not ad-hoc strings.
- External systems are reached through `adapters/`, never by importing an SDK in a service. The ML service is an adapter like any other.

### 2.2 Web structure

```
web/src/
├── app/
│   ├── (public)/               # renders bare: login, forgot-password
│   └── (protected)/            # layout injects AuthGuard + Header + SideNav
│       ├── dashboard/
│       ├── service-user/       # resident list + [id] detail (incl. Development tab)
│       ├── assessment/
│       ├── iep/
│       ├── adl-tracking/
│       ├── calendar/
│       ├── incidents/
│       ├── insights/           # trajectories, decline flags, risk board
│       ├── notifications/
│       └── user-management/
├── components/ui/              # shared primitives
├── stores/                     # Zustand, split by domain
│   ├── auth-store.ts
│   ├── resident-store.ts
│   ├── notification-store.ts
│   └── create-fetch-store.ts   # generic factory for one-off API-backed lists
├── lib/api-client.ts           # typed api.get/post/patch/delete, 401 → refresh → retry → login
└── config/theme.ts             # single source of truth for design tokens
```

Adding an authenticated page = create a folder under `(protected)/`. Nothing else.

**Simplification vs IAC:** Tailwind only. IAC mixes Tamagui primitives with Tailwind layout; we drop Tamagui and build the handful of primitives we need directly.

**Mobile-first pages.** `adl-tracking/` and `incidents/new` are the two screens a PSS uses in the field on a phone. They are built mobile-first and only then widened for desktop; the rest of the app is built desktop-first and merely kept from breaking on a small screen. Specifics in §2.3.

### 2.3 PSS on the web — mobile-first requirements

Since there is no PSS app, these rules apply to the ADL logging screen and the incident report form:

- Base layout is single-column at 360px; the desktop grid is a `md:` enhancement, not the default.
- Every interactive target is at least 44×44px. No hover-only affordances — everything must work on touch.
- The ADL logging screen defaults to *today* and *the current shift*, so the common case is: open, tap status, tap mood, submit. No date picker required for the normal path.
- Inputs use the right mobile keyboard (`inputMode`, `type`) and native `<select>` on touch devices rather than custom dropdowns.
- The log form keeps unsaved input in the Zustand store, so a backgrounded browser tab doesn't lose a half-filled entry.
- The submit button is sticky to the bottom of the viewport on small screens.
- Tested at 360×640 in a real mobile browser, not just a desktop devtools viewport.

### 2.4 Parent mobile app structure

One Expo codebase, `PARENT` role only. Read-only.

```
parent-mobile/app/
├── (auth)/login.tsx
└── (tabs)/
    ├── my-child.tsx            # profile, status, care team
    ├── progress.tsx            # IEP goal progress + ADL compliance + trajectory
    └── notifications.tsx       # incidents flagged for parents, schedule changes
```

Login rejects any non-`PARENT` role with "this app is for parents — staff should use the web app". A parent linked to more than one resident gets a child switcher in the header.

Parents see trajectory direction in plain language ("steady progress in communication over the last month"), never a risk score. Risk flags are clinical triage output and stay with staff.

### 2.5 ML service structure

```
ml-service/
├── app/
│   ├── main.py                 # FastAPI, 3 endpoints
│   ├── features.py             # feature engineering from the exported record
│   ├── trajectory.py           # independence index + trend fitting
│   ├── decline.py              # baseline deviation detection
│   ├── risk.py                 # incident-risk classifier: load, predict, explain
│   └── schemas.py              # pydantic request/response contracts
├── training/
│   ├── train_risk_model.py     # temporal split, fit, evaluate, persist
│   └── evaluation.md           # metrics table, confusion matrix, limitations
├── models/                     # committed .joblib artefacts + a metrics.json
├── tests/
├── requirements.txt
└── Dockerfile
```

Stateless. It never touches Postgres — the backend sends it the data it needs and stores what comes back. That keeps the DB in one owner's hands and makes the service trivially testable.

---

## 3. Roles and permissions

Six roles — a faithful subset of IAC's fourteen.

| Role | Who they are | What they do |
|---|---|---|
| `SUPER_ADMIN` | System administrator | Manage users, manage catalogues (assessment types, ADL activities, rooms), see everything |
| `CSC` | Clinical Services Coordinator | Enrol residents, assign care teams, schedule assessments and sessions, approve ADL logs, act on decline flags |
| `JR_PSYCHOLOGIST` | Junior psychologist | Conduct assessments, author IEP plans and goals, review trajectories |
| `MDT_HEAD` | Multi-Disciplinary Team head | Approve/reject assessments, approve/reject IEP goals, review escalated incidents and risk flags |
| `PSS` | Personal Support Staff | Log ADL/IADL activities, log IEP goal progress, report incidents |
| `PARENT` | Resident's parent/guardian | Read-only view of their own child |

### 3.1 Permission matrix

`R` = read, `W` = create/update, `A` = approve/reject, `—` = no access.
Scoped entries are limited to residents the user is assigned to (`ResidentStaffAssignment`) or, for `PARENT`, linked to (`ResidentParent`).

| Resource | SUPER_ADMIN | CSC | JR_PSYCHOLOGIST | MDT_HEAD | PSS | PARENT |
|---|---|---|---|---|---|---|
| Users | RW | R | — | R | — | — |
| Residents | RW | RW | R *(scoped)* | R | R *(scoped)* | R *(own child)* |
| Care team assignment | RW | RW | — | R | — | — |
| Assessments | R | RW *(schedule)* | RW *(scoped)* | RA | — | R *(own child)* |
| IEP plans & goals | R | R | RW *(scoped)* | RA | R *(scoped)* | R *(own child)* |
| Goal progress logs | R | R | R | R | RW *(scoped)* | R *(own child)* |
| ADL catalogue | RW | R | — | R | R | — |
| ADL assignments | R | RW | — | R | R *(scoped)* | — |
| ADL logs | R | RA | — | R | RW *(scoped)* | R *(own child)* |
| Calendar slots | RW | RW | R *(own)* | R | R *(own)* | R *(own child)* |
| Incidents | R | RW | R | RA | RW *(scoped)* | R *(own child, if flagged)* |
| Development trajectory | R | R | R *(scoped)* | R | R *(scoped)* | R *(own child, simplified)* |
| Incident risk band | R | R | R *(scoped)* | R | — | — |
| Notifications | R *(own)* | R *(own)* | R *(own)* | R *(own)* | R *(own)* | R *(own)* |

Enforcement lives in two layers: `auth.middleware.ts` checks the role against a route-level permission constant, and the service layer applies the resident-scoping filter. Both are required — a route guard alone does not stop a `PSS` reading a resident they aren't assigned to.

---

## 4. Data model

22 Prisma models. Every model gets `id` (cuid), `createdAt`, `updatedAt`. Soft-delete via `deletedAt` on `User`, `Resident`, `Room`, `AdlActivity`, `AssessmentType`.

### 4.1 Enums

Trimmed from IAC's originals, keeping the real value names so the vocabulary carries over.

```prisma
enum UserRole { SUPER_ADMIN CSC JR_PSYCHOLOGIST MDT_HEAD PSS PARENT }

enum ClinicalDomain { PSYCHOLOGY OCCUPATIONAL_THERAPY SPEECH_THERAPY SPECIAL_EDUCATION }

enum Gender { MALE FEMALE OTHER }

enum ProgramType { COMMUNITY FAMILY_LIVING }

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
}

enum StaffAssignmentRole { CSC PSS JR_PSYCHOLOGIST MDT_HEAD }

enum AssessmentStatus { PENDING SCHEDULED IN_PROGRESS SUBMITTED APPROVED REVISION_REQUESTED }

enum IepStatus { DRAFT_IEP SUBMITTED_IEP APPROVED_IEP ACTIVE_IEP COMPLETED_IEP REJECTED_IEP }

enum IepGoalApprovalStatus { NOT_SUBMITTED PENDING_MDT_APPROVAL APPROVED_MDT REJECTED_MDT }

enum IepAssignedRole { PSS CLINICIAN }

enum GoalFrequency { DAILY WEEKLY MONTHLY }

enum GoalStatus { NOT_STARTED IN_PROGRESS_GOAL ACHIEVED PARTIALLY_ACHIEVED DISCONTINUED_GOAL }

enum IepLogOutcome { ACHIEVED_LOG PARTIALLY_ACHIEVED_LOG NOT_ACHIEVED_LOG }

enum PromptLevel { INDEPENDENT VERBAL GESTURAL PARTIAL_PHYSICAL FULL_PHYSICAL }

enum Shift { MORNING EVENING NIGHT }

enum AdlCategory { ADL IADL }

enum AdlLogStatus { TODO IN_PROGRESS_ADL DONE }

enum AdlApprovalStatus { DRAFT SUBMITTED APPROVED REJECTED }

enum AdlMood { CALM ANXIOUS ESCALATED MELTDOWN }

enum RoomType { THERAPY ASSESSMENT_ROOM CONSULTATION CLASSROOM GENERAL }

enum SlotType { ASSESSMENT_SLOT THERAPY_SESSION IPP_ACTIVITY IPP_MEETING_SLOT GENERAL_SLOT }

enum SlotStatus { SCHEDULED_SLOT CONFIRMED IN_PROGRESS_SLOT COMPLETED_SLOT CANCELLED_SLOT }

enum IncidentType { INJURY AGGRESSION MELTDOWN SELF_HARM FALL ELOPEMENT OTHER_INCIDENT }

enum IncidentStatus { REPORTED UNDER_REVIEW ESCALATED RESOLVED CLOSED }

enum TrajectoryDirection { IMPROVING STABLE DECLINING INSUFFICIENT_DATA }

enum RiskBand { LOW MEDIUM HIGH }

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
}

enum NotificationSeverity { NORMAL HIGH CRITICAL_INTERRUPT }
```

### 4.2 Models

**Identity & audit (3)**

| Model | Key fields | Notes |
|---|---|---|
| `User` | `email` (unique), `passwordHash`, `firstName`, `lastName`, `role`, `clinicalDomain?`, `isActive`, `deletedAt?` | `clinicalDomain` set only for clinical roles |
| `UserSession` | `userId`, `refreshTokenHash`, `expiresAt`, `revokedAt?`, `userAgent?` | Refresh-token rotation; one row per active device |
| `AuditLog` | `actorUserId?`, `action`, `entityType`, `entityId`, `before` (Json?), `after` (Json?), `ipAddress?` | Written by services on every state transition |

**Residents (4)**

| Model | Key fields | Notes |
|---|---|---|
| `Resident` | `code` (unique, e.g. `RES-0001`), `firstName`, `lastName`, `dateOfBirth`, `gender`, `programType`, `status`, `admissionDate?` | `status` is the workflow chip. UI label is "Service User". |
| `ResidentStatusHistory` | `residentId`, `fromStatus?`, `toStatus`, `changedByUserId`, `reason?` | Append-only. Every transition writes here. |
| `ResidentStaffAssignment` | `residentId`, `userId`, `role` (`StaffAssignmentRole`), `assignedAt`, `unassignedAt?` | Unique on `(residentId, userId, role)` where `unassignedAt IS NULL` |
| `ResidentParent` | `residentId`, `parentUserId`, `relationship` | Links a `PARENT` user to their child |

**Assessments (2)**

| Model | Key fields | Notes |
|---|---|---|
| `AssessmentType` | `name`, `code` (unique), `domain` (`ClinicalDomain`), `description`, `isActive` | Catalogue, seeded — see §9.1 on instrument naming |
| `Assessment` | `residentId`, `assessmentTypeId`, `assignedToUserId`, `status`, `scheduledAt?`, `calendarSlotId?`, `findings` (Json?), `score?`, `submittedAt?`, `reviewedByUserId?`, `reviewNotes?` | `findings` holds structured answers |

**IEP (3)**

| Model | Key fields | Notes |
|---|---|---|
| `IepPlan` | `residentId`, `version` (int), `status` (`IepStatus`), `authoredByUserId`, `submittedAt?`, `approvedByUserId?`, `approvedAt?`, `startDate?`, `endDate?` | Unique on `(residentId, version)` |
| `IepGoal` | `iepPlanId`, `domain` (`ClinicalDomain`), `title`, `description`, `frequency`, `targetCount`, `status` (`GoalStatus`), `approvalStatus` (`IepGoalApprovalStatus`), `rejectionReason?`, `assignedRole` (`IepAssignedRole`) | Rejection is one-shot: rejected goals aren't resubmitted, a new goal replaces them |
| `GoalProgressLog` | `iepGoalId`, `loggedByUserId`, `logDate`, `outcome` (`IepLogOutcome`), `promptLevel` (`PromptLevel?`), `notes?` | One row per session. **Primary ML signal.** |

**ADL (3)**

| Model | Key fields | Notes |
|---|---|---|
| `AdlActivity` | `name`, `code` (unique), `category` (`AdlCategory`), `description`, `isActive` | Catalogue, seeded |
| `AdlAssignment` | `residentId`, `adlActivityId`, `assignedByUserId`, `frequency` (`GoalFrequency`), `isActive` | Which activities a resident is tracked on |
| `AdlLog` | `adlAssignmentId`, `loggedByUserId`, `logDate`, `shift` (`Shift`), `status` (`AdlLogStatus`), `promptLevel` (`PromptLevel?`), `mood` (`AdlMood?`), `notes?`, `approvalStatus`, `approvedByUserId?`, `rejectionReason?` | Unique on `(adlAssignmentId, logDate, shift)`. **Primary ML signal.** |

**Scheduling (2)**

| Model | Key fields | Notes |
|---|---|---|
| `Room` | `name` (unique), `type` (`RoomType`), `capacity`, `isActive` | |
| `CalendarSlot` | `type` (`SlotType`), `status` (`SlotStatus`), `startsAt`, `endsAt`, `roomId?`, `residentId?`, `staffUserId`, `title`, `notes?`, `createdByUserId` | Double-booking check on `(roomId, range)` and `(staffUserId, range)` |

**Incidents & notifications (3)**

| Model | Key fields | Notes |
|---|---|---|
| `Incident` | `residentId`, `reportedByUserId`, `type`, `status`, `occurredAt`, `location?`, `description`, `severity`, `notifyParent` (bool), `reviewedByUserId?`, `resolution?`, `resolvedAt?` | **ML label source.** |
| `Notification` | `userId`, `type`, `severity`, `title`, `body`, `entityType?`, `entityId?`, `readAt?` | In-app only; clients poll `/notifications` |
| `NotificationPreference` | `userId`, `type`, `enabled` | Per-user mute switches |

**Intelligence (2 — new)**

| Model | Key fields | Notes |
|---|---|---|
| `DevelopmentSnapshot` | `residentId`, `domain` (`ClinicalDomain`), `weekStart` (date), `independenceIndex` (float 0–1), `goalAchievementRate` (float), `adlCompletionRate` (float), `trajectory` (`TrajectoryDirection`), `slope` (float), `baselineDeviation` (float?), `computedAt` | One row per resident per domain per week. Unique on `(residentId, domain, weekStart)`. Recomputed idempotently. |
| `RiskAssessment` | `residentId`, `assessedFor` (date), `band` (`RiskBand`), `score` (float 0–1), `topFactors` (Json — ordered `[{feature, contribution, direction}]`), `modelVersion` (string), `computedAt` | One row per resident per run. `topFactors` is what the clinician actually reads. |

### 4.3 Resident status machine

```
IMPORTED
   │ CSC approves enrolment
   ▼
ENROLLED
   │ CSC assigns themselves / a CSC
   ▼
CSC_ASSIGNED
   │ CSC assigns JR_PSYCHOLOGIST + MDT_HEAD + PSS
   ▼
MDT_ASSIGNED
   │ CSC schedules assessments into calendar slots
   ▼
ASSESSMENTS_SCHEDULED
   │ first assessment moves to IN_PROGRESS
   ▼
ASSESSMENTS_IN_PROGRESS
   │ all assessments APPROVED by MDT_HEAD
   ▼
ASSESSMENTS_COMPLETED
   │ JR_PSYCHOLOGIST creates an IepPlan
   ▼
IEP_IN_PROGRESS
   │ MDT_HEAD approves the plan
   ▼
IEP_APPROVED
   │ CSC assigns ADL activities and activates the plan
   ▼
ACTIVE  ⇄  INACTIVE
```

Transitions are centralised in `resident.service.ts`. A single `transitionStatus(residentId, toStatus, actor, reason)` method validates against an allow-list, writes `ResidentStatusHistory` + `AuditLog`, and emits notifications — no other code sets `Resident.status` directly.

---

## 5. Workflows

### 5.1 Enrolment and care-team assignment

1. `SUPER_ADMIN` or `CSC` creates a resident → status `IMPORTED`.
2. `CSC` reviews and approves → `ENROLLED`.
3. `CSC` assigns a CSC → `CSC_ASSIGNED`.
4. `CSC` assigns `JR_PSYCHOLOGIST`, `MDT_HEAD`, and one or more `PSS` → `MDT_ASSIGNED`. Each assignee gets `CARE_TEAM_ASSIGNED`.
5. `CSC` links a `PARENT` user via `ResidentParent`.

**Rules.** A resident cannot advance past `CSC_ASSIGNED` without exactly one active CSC assignment. Un-assigning the last CSC is blocked while the resident is `ACTIVE`.

### 5.2 Assessment → IEP plan

1. `CSC` selects assessment types and schedules each into a `CalendarSlot` (type `ASSESSMENT_SLOT`, room + clinician + time). Assessment `PENDING → SCHEDULED`, resident → `ASSESSMENTS_SCHEDULED`. Clinician gets `ASSESSMENT_SCHEDULED`.
2. `JR_PSYCHOLOGIST` opens the assessment → `IN_PROGRESS` (resident → `ASSESSMENTS_IN_PROGRESS`), fills findings, submits → `SUBMITTED`. `MDT_HEAD` gets `ASSESSMENT_COMPLETED`.
3. `MDT_HEAD` approves → `APPROVED`, or requests revision → `REVISION_REQUESTED` with notes (back to step 2).
4. When every assessment for the resident is `APPROVED` → resident `ASSESSMENTS_COMPLETED`.
5. `JR_PSYCHOLOGIST` creates `IepPlan` v1 (`DRAFT_IEP`), adds `IepGoal` rows across clinical domains → resident `IEP_IN_PROGRESS`.
6. Clinician submits the plan → `SUBMITTED_IEP`; every goal moves `NOT_SUBMITTED → PENDING_MDT_APPROVAL`. `MDT_HEAD` gets `IEP_SUBMITTED`.
7. `MDT_HEAD` approves or rejects **each goal individually**. Rejection requires a reason and is terminal for that goal.
8. Once every goal is decided and at least one is `APPROVED_MDT`, the plan → `APPROVED_IEP` and the resident → `IEP_APPROVED`. If all goals were rejected the plan → `REJECTED_IEP` and the clinician authors v2.
9. `CSC` activates the plan → `ACTIVE_IEP`, resident → `ACTIVE`. Recurring `IPP_ACTIVITY` slots are generated from each approved goal's `frequency`.

### 5.3 Daily activity logging and approval

1. `SUPER_ADMIN` maintains the `AdlActivity` catalogue.
2. `CSC` creates `AdlAssignment` rows for a resident, each with a frequency.
3. `PSS` logs per assignment, per date, per shift in the web app — typically on a phone browser during the shift: status, prompt level, mood, notes. Saved as `DRAFT`, submitted as `SUBMITTED`.
4. `CSC` sees a queue of `SUBMITTED` logs, approves (`APPROVED`) or rejects with a reason (`REJECTED`). Rejection notifies the logging PSS (`ADL_LOG_REJECTED`).
5. Approved logs feed the resident dashboard's compliance figure and are the input to §5.5.

**Rules.** One log per `(assignment, date, shift)`. A `PSS` may only log for residents they are actively assigned to. Approved logs are immutable.

### 5.4 Incident reporting

1. `PSS` or `CSC` files an incident: type, severity, when, where, description, `notifyParent` flag → `REPORTED`. The care team gets `INCIDENT_REPORTED`; if `notifyParent`, the linked parent does too.
2. `MDT_HEAD` moves it to `UNDER_REVIEW`, then either `ESCALATED` (severity forced to `CRITICAL_INTERRUPT`, notifies all `SUPER_ADMIN`s) or `RESOLVED` with a resolution note.
3. `CSC` closes it → `CLOSED`.

### 5.5 Development monitoring (the intelligence layer)

Runs nightly as `nightly-insights.job.ts`, per active resident. Nothing here happens in a request path.

1. Backend exports the resident's last 16 weeks of `GoalProgressLog`, `AdlLog`, and `Incident` rows.
2. Backend `POST`s that record to `ml-service`.
3. ML service returns per-domain trajectories, a decline verdict, and a risk band with contributing factors.
4. Backend upserts `DevelopmentSnapshot` rows and inserts a `RiskAssessment` row.
5. If a domain flips to `DECLINING`, the CSC and MDT_HEAD get `PERFORMANCE_DECLINE_DETECTED`. If the risk band rises to `HIGH`, they get `ELEVATED_RISK_FLAGGED`.
6. Clinician opens `/insights` or a resident's Development tab and sees the trajectory chart, the flag, and the reasons behind it.

**Human-in-the-loop is a hard constraint.** The model surfaces information; it never acts. It does not change a care plan, close a goal, alter a status, schedule anything, or notify a parent. Every output lands in front of a clinician who decides. This is stated here because it is a design rule, not an implementation detail — any future feature that lets the model act is out of scope by definition.

---

## 6. The ML component

### 6.1 What it computes

**A. Independence index and development trajectory** *(descriptive — the "monitoring")*

Per resident, per clinical domain, per week, collapse the logs into one number in `[0, 1]`:

- Goal outcomes: `ACHIEVED_LOG` = 1.0, `PARTIALLY_ACHIEVED_LOG` = 0.5, `NOT_ACHIEVED_LOG` = 0.
- Prompt levels: `INDEPENDENT` = 1.0, `VERBAL` = 0.75, `GESTURAL` = 0.5, `PARTIAL_PHYSICAL` = 0.25, `FULL_PHYSICAL` = 0.
- `independenceIndex` = weighted mean of both, weighted by number of observations.

Fit ordinary least squares over the last 8 weekly points. The slope, with its standard error, gives `IMPROVING` / `STABLE` / `DECLINING`; fewer than 4 points gives `INSUFFICIENT_DATA` rather than a guess.

**B. Early decline detection** *(statistical — the alerting)*

Compare the most recent 2-week mean against the resident's own 8-week baseline as a z-score. Below −2.0 raises a decline flag. Each resident is their own control, which sidesteps the between-person comparison that makes population norms inappropriate here.

**C. Incident risk prediction** *(supervised ML — the predictive piece)*

Binary classification: *will this resident have an incident in the next 7 days?*

| | |
|---|---|
| **Features** | Mood distribution over 7 and 14 days (proportion `ANXIOUS` / `ESCALATED` / `MELTDOWN`); mood trend; ADL completion rate and its 7-day delta; goal achievement rate and delta; independence-index slope; days since last incident; prior incident count by type over 30/90 days; count of shifts with a missing log; resident age band; days since last care-team change |
| **Model** | `HistGradientBoostingClassifier`, with `LogisticRegression` as a reported baseline. Both are tabular, fast, and explainable — deep learning is an explicit non-goal and would be indefensible on this data volume. |
| **Split** | Temporal, not random. Train on weeks 1–12, test on weeks 13–16. A random split would leak future information about the same resident into training and inflate every metric. |
| **Metrics** | ROC-AUC, precision, recall, F1, confusion matrix at the chosen threshold, and a precision-recall curve. Recall is weighted above precision: a missed escalation costs more than a false alarm a clinician dismisses. |
| **Explainability** | Permutation importance globally; per-prediction contributions surfaced as `topFactors` so the UI can say *"flagged because escalated moods rose from 8% to 31% and ADL completion fell 22%"* rather than showing a bare number. |
| **Thresholds** | `LOW` < 0.3, `MEDIUM` 0.3–0.6, `HIGH` > 0.6, tuned on the validation set and recorded in `metrics.json`. |

### 6.2 The training data problem — read this before writing the report

**There is no real data.** A new system starts empty, and real autism care records are neither obtainable nor ethically usable for a college project. So `prisma/generate-history.ts` synthesises 16 weeks of longitudinal logs for 30 residents, with behavioural patterns deliberately planted: mood escalation preceding some incidents, ADL decline following a care-team change, steady improvement in some domains, plateau in others, plus noise and realistic missing data.

That has a consequence you must state plainly and repeatedly:

> The model learns the patterns we planted. Good metrics demonstrate that the feature engineering, training, evaluation, and serving pipeline works end to end. **They say nothing about whether the model would predict real incidents for real people.**

Concretely, this means:

- `training/evaluation.md` opens with this limitation, not buries it.
- The report has a Limitations section saying the same thing.
- No screen, caption, or slide says "accuracy" without saying "on synthetic data".
- The demo script says it out loud.

This is the single most likely thing to be challenged in a viva, and being the one to raise it is far stronger than being caught by it. It also matters on its own terms: this is a vulnerable population, and a system that overstated its predictive power would be harmful, not just embarrassing.

**Fairness check.** `training/evaluation.md` also reports the flag rate broken down by gender and program type. If the model flags one group far more than another, that goes in the report as a finding — a known limitation honestly reported beats a fairness problem nobody looked for.

### 6.3 API contract

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness, plus the loaded `modelVersion` |
| `POST /analyze/trajectory` | Log history in → per-domain weekly indices, slopes, trajectories, decline flags out |
| `POST /predict/risk` | Feature window in → band, score, `topFactors` out |

Pydantic schemas on both sides; the backend's `adapters/ml/` mirrors them as Zod schemas so a contract drift fails typecheck rather than silently returning nulls.

**Graceful degradation.** If the ML service is down or slow, the nightly job logs a warning, skips the run, and leaves yesterday's snapshots in place. The web app shows insights with a "last computed" timestamp and an explicit stale state. No user-facing feature breaks because the ML service is unavailable — the care system's core function must not depend on it.

---

## 7. API surface

Base URL `http://localhost:5000`. Responses are `{ data, meta? }` or `{ error: { code, message, details? } }`. List endpoints take `?page&limit&sort&q` and return `meta: { page, limit, total }`.

| Prefix | Endpoints |
|---|---|
| `/healthz` | `GET /` |
| `/auth` | `POST /login`, `POST /refresh`, `POST /logout`, `GET /me` |
| `/users` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| `/residents` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `POST /:id/status`, `GET /:id/history`, `GET /:id/team`, `POST /:id/team`, `DELETE /:id/team/:assignmentId`, `POST /:id/parents` |
| `/assessments` | `GET /types`, `POST /types`, `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `POST /:id/submit`, `POST /:id/review` |
| `/iep` | `GET /plans`, `POST /plans`, `GET /plans/:id`, `POST /plans/:id/submit`, `POST /plans/:id/activate`, `POST /plans/:id/goals`, `PATCH /goals/:id`, `POST /goals/:id/review`, `POST /goals/:id/progress`, `GET /goals/:id/progress` |
| `/adl` | `GET /activities`, `POST /activities`, `GET /assignments`, `POST /assignments`, `PATCH /assignments/:id`, `GET /logs`, `POST /logs`, `PATCH /logs/:id`, `POST /logs/:id/submit`, `POST /logs/:id/review`, `GET /logs/pending-approval` |
| `/calendar` | `GET /slots`, `POST /slots`, `PATCH /slots/:id`, `DELETE /slots/:id`, `GET /rooms`, `POST /rooms`, `GET /availability` |
| `/incidents` | `GET /`, `POST /`, `GET /:id`, `POST /:id/review`, `POST /:id/resolve`, `POST /:id/close` |
| `/insights` | `GET /residents/:id/trajectory`, `GET /residents/:id/risk`, `GET /decline-flags`, `GET /risk-board`, `POST /recompute/:residentId` *(admin, manual re-run)* |
| `/notifications` | `GET /`, `GET /unread-count`, `POST /:id/read`, `POST /read-all`, `GET /preferences`, `PATCH /preferences` |
| `/dashboard` | `GET /summary`, `GET /resident/:id` |

Swagger UI at `/swagger`, generated from the Elysia route schemas.

**Auth.** `POST /auth/login` sets two httpOnly cookies — `access_token` (15 min) and `refresh_token` (7 days). Tokens never appear in the response body. `POST /auth/refresh` rotates the refresh token and revokes the old `UserSession` row. The parent app uses the same endpoints with a cookie jar (`expo-secure-store` backed).

---

## 8. Error handling

An `AppError` hierarchy in `common/errors.ts`, each mapping to a status and a stable machine-readable code:

| Class | Status | Code example |
|---|---|---|
| `ValidationError` | 400 | `VALIDATION_FAILED` |
| `UnauthorizedError` | 401 | `INVALID_CREDENTIALS`, `TOKEN_EXPIRED` |
| `ForbiddenError` | 403 | `INSUFFICIENT_ROLE`, `RESIDENT_NOT_ASSIGNED` |
| `NotFoundError` | 404 | `RESIDENT_NOT_FOUND` |
| `ConflictError` | 409 | `DUPLICATE_ADL_LOG`, `SLOT_OVERLAP` |
| `InvalidTransitionError` | 422 | `INVALID_STATUS_TRANSITION` |
| `UpstreamUnavailableError` | 503 | `ML_SERVICE_UNAVAILABLE` |

A single Elysia `onError` handler maps `AppError` → its status, logs it with the request ID, and returns the envelope. Unrecognised errors log a stack trace and return a generic 500 — internals never leak to the client. Zod failures are caught at the route boundary and returned as `VALIDATION_FAILED` with a field-level `details` array.

---

## 9. Test and seed data

### 9.1 Baseline seed (`prisma/seed.ts`)

- 1 `SUPER_ADMIN`, 2 `CSC`, 2 `JR_PSYCHOLOGIST`, 1 `MDT_HEAD`, 3 `PSS`, 4 `PARENT` — all with a known password.
- 8 `AssessmentType` rows across the four clinical domains.
- 12 `AdlActivity` rows (8 `ADL`, 4 `IADL`).
- 6 `Room` rows.
- 10 residents spread deliberately across the status machine: 2 `IMPORTED`, 1 `ENROLLED`, 1 `MDT_ASSIGNED`, 2 `ASSESSMENTS_IN_PROGRESS`, 1 `ASSESSMENTS_COMPLETED`, 1 `IEP_IN_PROGRESS`, 2 `ACTIVE`.

Every screen therefore has something meaningful on it the moment the app starts.

> **On assessment instruments.** Real autism assessment instruments (ADOS-2, CARS-2, Vineland-3, ISAA and similar) are copyrighted and licensed. The catalogue seeds *descriptive names and domains only*, with simplified generic rubrics of our own — it is not an implementation of any licensed instrument, and the report should say so in one line. Using a real instrument's actual items and scoring would be a licensing problem, not a technical one.

### 9.2 Synthetic longitudinal data (`prisma/generate-history.ts`)

A separate, explicitly-named script — never blended into the normal seed, so nobody can mistake generated data for recorded data.

- 30 additional `ACTIVE` residents, 16 weeks of history each.
- Per resident: 3–6 IEP goals with progress logs at their frequency; 4–8 ADL assignments logged per shift; incidents generated from a per-resident hazard that rises with recent escalated moods and falls after a settled week.
- Planted patterns: gradual improvement, plateau, decline following a care-team change, and mood escalation preceding roughly 60% of incidents. The remaining 40% are unpredictable by design — a model that hits 100% recall on this data is a bug, not a triumph.
- Realistic missingness: ~12% of expected logs absent, weekend coverage thinner.
- Deterministic under a fixed seed so results reproduce.

### 9.3 Tests

Bun's built-in test runner for the backend; `pytest` for the ML service. Not chasing coverage — testing what encodes the rules.

| Layer | What's tested |
|---|---|
| Services | Every state transition: the legal path, and at least two illegal transitions per machine |
| Authorization | `PSS` cannot read an unassigned resident; `PARENT` cannot read another child; `JR_PSYCHOLOGIST` cannot approve their own assessment; `PSS` cannot read a risk band |
| Repos | Uniqueness constraints: duplicate ADL log, overlapping calendar slot |
| Auth | Login, refresh rotation, refresh reuse after revocation is rejected |
| ML service | Independence index on hand-computed fixtures; trajectory on synthetic improving/declining/flat series; `INSUFFICIENT_DATA` under 4 points; risk endpoint contract shape |
| Nightly job | ML service unreachable → warning logged, prior snapshots intact, no partial writes |
| Web | None automated — manual QA against a demo checklist |

Backend tests run against a throwaway Postgres schema created per run.

---

## 10. Build phases

Each phase ends with something demoable. Backend and web tracks inside a phase can run in parallel once the API contract for that phase is agreed.

| # | Phase | Deliverable | Done when | Weeks |
|---|---|---|---|---|
| 0 | **Foundation** | Monorepo scaffolded, Docker Compose Postgres, full Prisma schema + first migration, seed script, `configs.ts`, logger, error handler, `/healthz`, Swagger | `bun dev` starts, `/healthz` returns 200, `bun run db:setup` seeds 10 residents | 1 |
| 1 | **Auth & users** | Login/refresh/logout with cookie JWT, `auth.middleware`, permission matrix, `/users` CRUD, web login + protected shell + `api-client` refresh flow, user-management page | Each of the 6 seeded roles logs in and sees a role-appropriate nav | 1.5 |
| 2 | **Residents & care team** | `/residents` with status machine, history, team assignment, parent linking; web resident list + detail + team tab | A resident walks `IMPORTED → MDT_ASSIGNED` in the UI, with history visible | 1.5 |
| 3 | **Assessments & IEP** | `/assessments` and `/iep` complete; web assessment queue, assessment form, IEP builder, goal approval screen | Workflow 5.2 runs end to end for one resident | 2 |
| 4 | **ADL (mobile-first)** | `/adl` complete; web catalogue admin, assignment screen, approval queue, and the PSS logging screen built to §2.3 | Workflow 5.3 end to end; a PSS completes a log on a 360px phone browser | 2 |
| 5 | **Calendar, incidents, notifications** | `/calendar` with conflict detection, `/incidents`, `/notifications`; web calendar, mobile-first incident form, notification bell | Workflow 5.4 end to end; scheduling an assessment creates a real slot and a real notification | 2 |
| 6 | **Synthetic history & ML service** | `generate-history.ts`, `ml-service` with all three endpoints, trained + evaluated risk model, `evaluation.md` | 16 weeks of history for 30 residents; `evaluation.md` reports temporal-split metrics and the synthetic-data limitation | 2 |
| 7 | **Insights integration** | `adapters/ml/`, nightly job, `DevelopmentSnapshot` + `RiskAssessment`, `/insights`, web Development tab + risk board, decline notifications | Workflow 5.5 end to end; killing the ML service degrades gracefully | 1.5 |
| 8 | **Parent mobile app** | Expo app, `PARENT`-only login, secure token storage, three tabs | A parent sees their child's live progress and notifications on a device | 1.5 |
| 9 | **Hardening & docs** | Tests, seed polish, README, architecture + ER diagrams, demo script, report Limitations section | `bun run check` clean, tests green, 10-minute demo runs without a hitch | 1 |

**Total:** ~16 solo-equivalent weeks. With 2–4 people running backend/web/ML tracks in parallel from Phase 2 onward, roughly 10 calendar weeks — inside the 2–3 month window, without much slack.

**Suggested split for a team of 3:** one on backend services + repos, one on web, one on schema/seed early → ML service from Phase 4 → parent app from Phase 8. The ML person can start `generate-history.ts` as soon as the schema lands in Phase 0, since it depends on the schema and nothing else.

### Cut list, in priority order

If time runs short, drop from the bottom up. Each cut is self-contained and leaves a coherent system:

1. Parent mobile app — parents get a read-only web view instead
2. `NotificationPreference` (all notifications always on)
3. Calendar conflict detection (allow double-booking, flag it visually)
4. Incident escalation path (`REPORTED → RESOLVED → CLOSED` only)
5. Incident-risk prediction (§6.1C) — keep trajectory and decline detection, which still justify "intelligent monitoring" and need no trained model

Not cuttable: the PSS logging screen and its mobile-first requirements — that is the primary daily-use path of the whole system. Nor §6.2's honesty requirements, whatever else gets cut.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| The ML looks impressive but is trained on data we invented | §6.2 is binding: state it in `evaluation.md`, the report, and the demo. Own it before the examiner finds it. |
| Model outputs get treated as clinical fact | Human-in-the-loop is a hard rule (§5.5). The model never acts. The UI always shows the reasons, never a bare score. |
| ML slips and the "Intelligent" title goes unearned | Phases 6–7 are separated so the descriptive layer (trajectories, decline flags) ships even if the predictive model doesn't. Item 5 on the cut list, not item 1. |
| Status machine sprawls as edge cases appear | Transition allow-list is a single table in `resident.service.ts`. Adding a status means editing one map. |
| The team blocks on the API contract | Each phase starts by writing the Zod schemas in `repos/schemas/` first; web codes against those types immediately. |
| "Responsive later" — PSS logging ships desktop-only and is unusable in the field | §2.3 is a Phase 4 acceptance criterion, tested on a real handset. |
| Proprietary IAC code leaks into a public repo | `iac/` lives outside the repo. Check `git status` before the first push and keep the check in the Phase 0 checklist. |
| Scope creep back toward full IAC | The non-goals list in §1 is binding. Anything not in §5 needs an explicit decision to add. |
| Demo depends on hand-built data | Both seed scripts are phase deliverables, re-run before every demo. |

---

## 12. Open questions

None blocking. One to settle during Phase 0:

- **Public vs private repo.** The repo is currently public. All resident data is synthetic, so there is no privacy issue, but a public repo means the code is visible to other students. Your call — it changes nothing technically.
