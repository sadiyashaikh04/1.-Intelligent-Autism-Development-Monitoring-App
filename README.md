# Intelligent Autism Development Monitoring App (IADM)

A multi-role clinical care management system for autism development monitoring, with an intelligence layer over the longitudinal care record.

Support staff record structured daily observations against individualised goals; clinicians run assessments and author care plans; an ML service turns that record into per-domain development trajectories, early-decline alerts, and incident-risk flags for clinicians to act on.

> **Status:** design complete, implementation not yet started.
> Full design: [`docs/specs/2026-08-04-iadm-autism-monitoring-design.md`](docs/specs/2026-08-04-iadm-autism-monitoring-design.md)

## Structure

| Path | What it is | Stack | Port |
|---|---|---|---|
| `backend/` | API server | Bun + Elysia + Prisma + PostgreSQL 16 | 5000 |
| `web/` | Web app — all staff roles, desktop and phone | Next.js 16 + React 19 + Tailwind 4 + Zustand | 3000 |
| `parent-mobile/` | Parent app, read-only | Expo + Expo Router + NativeWind | — |
| `ml-service/` | Trajectory, decline detection, risk prediction | Python 3.12 + FastAPI + scikit-learn | 8000 |

Each subproject keeps its own lockfile and lifecycle. `cd` into one before running anything.

## Roles

`SUPER_ADMIN` · `CSC` (Clinical Services Coordinator) · `JR_PSYCHOLOGIST` · `MDT_HEAD` · `PSS` (Personal Support Staff) · `PARENT`

## Important — on the data and the model

**All data in this project is synthetic.** No real clinical records are used, and none should ever be added.

The incident-risk model is trained on generated longitudinal data with behavioural patterns deliberately planted by `backend/prisma/generate-history.ts`. Its evaluation metrics demonstrate that the feature engineering, training, evaluation, and serving pipeline works end to end. **They say nothing about whether the model would predict real incidents for real people.** See `ml-service/training/evaluation.md`.

The model never acts. It surfaces information to a clinician who decides. It cannot change a care plan, close a goal, alter a resident's status, schedule anything, or notify a parent.

Assessment types in the catalogue use descriptive names and domains with simplified rubrics of our own. This is not an implementation of ADOS-2, CARS-2, Vineland-3, ISAA or any other licensed instrument.

## Academic project

Built as a college major project. Architecture and clinical vocabulary follow a production clinical care suite; the scope is roughly one-fifth of it, plus the ML layer.
