# IADM Web

Next.js 16 + React 19 + Tailwind 4 + Zustand. The staff web app (desktop and phone) plus a read-only parent view.

> **Demo build — all sample data.** This version runs entirely in the browser on a synthetic dataset that mirrors the backend schema. Nothing is sent to or read from the database, and there is no real authentication yet. It was built ahead of Phase 1 for a submission on 2026-10-16; work now returns to the original plan (Phase 1: auth & users), wiring these pages to the backend phase by phase through `src/lib/data-source.ts`.

## Run it

```bash
bun install
bun dev          # http://localhost:3000
```

| Command | What it does |
|---|---|
| `bun dev` | Dev server on port 3000 |
| `bun run build` | Production build (also type-checks) |
| `bun run lint` | ESLint |
| `bun run test` | Domain-logic unit tests (permissions, status machine, workflow mutations) |

## Demo accounts

Pick any account on the login page — the password is not checked in demo mode.

| Role | Account | Lands on |
|---|---|---|
| Super Admin | Aisha Rahman · `admin@iadm.local` | Dashboard |
| Care Coordinator (CSC) | Priya Nair · `csc1@iadm.local` | Dashboard |
| Junior Psychologist | Sara Khan · `psych1@iadm.local` | Dashboard |
| MDT Head | Vikram Desai · `mdthead@iadm.local` | Dashboard |
| Personal Support Staff | Meera Joshi · `pss1@iadm.local` | Today |
| Parent | Deepa Iyer · `parent1@iadm.local` | My Child |

Changes you make are kept for the browser tab (so a demo can hop between roles) and reset with **Reset demo data** in the user menu, or by closing the tab.

## A 10-minute demo

1. **Login** — point out one account per role and the demo-mode note.
2. **CSC (Priya)** — Dashboard queues → Service Users → *Aarav Sharma* → **Advance status** to Enrolled → History tab shows it. Assessments → **Schedule** for *Ananya Bose* (creates a calendar slot and notifies the psychologist).
3. **Psychologist (Sara)** — My Assessments → *Vivaan Reddy, Expressive Communication* → rate the items → **Submit for MDT review**. IEP Builder → **Create plan** for *Aryan Gupta* → add two suggested goals → **Submit for approval**.
4. **MDT Head (Vikram)** — Assessment Reviews → approve Vivaan's two (he moves to *Assessments completed*). Goal Approvals → Aryan's plan → approve one goal, reject one with a reason.
5. **CSC again** — IEP Plans → **Activate plan** → Aryan becomes *Active*.
6. **PSS on a phone (Meera)** — resize to ~360px. **Log activities**: tap *Done*, tap *Calm*, **Submit**. **Report incident** for *Reyansh Pillai* with "Let the parent know".
7. **MDT Head** — Incident Review → **Start review** → **Resolve**. Insights → *Saanvi Deshmukh*: declining trajectory, HIGH risk, and the reasons behind it.
8. **Parent (Deepa)** — My Child: plain-language progress, goals, the care team — and no risk score.
9. **Say it out loud:** the data is synthetic; the insights demonstrate the pipeline, not clinical validity; the model only flags — a clinician decides.

## Structure

```
src/
├── app/(public)/login       demo login
├── app/(protected)/…        one folder per section; the layout guards by role
├── components/              ui primitives, layout, and per-domain pieces
├── data/types.ts            record types mirroring backend/prisma/schema.prisma
├── data/seed/               the synthetic sample dataset (deterministic)
├── lib/domain/              pure, unit-tested rules: permissions, transitions, queries, mutations
├── lib/data-source.ts       THE seam: pages read via useQuery(...) and write via useActions()
└── stores/                  Zustand: demo session, demo data, ADL drafts
```

Assessment types use descriptive names with simplified rubrics of our own — not an implementation of ADOS-2, CARS-2, Vineland-3, ISAA or any other licensed instrument.
