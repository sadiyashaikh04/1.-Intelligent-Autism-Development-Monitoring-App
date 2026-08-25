# Intelligent Autism Development Monitoring App
## Progress Report No. 1

**Date:** 4 August 2026  |  **Session:** Day 1
**Repository (online code storage):** github.com/sadiyashaikh04/1.-Intelligent-Autism-Development-Monitoring-App

---

## 1. What this project is, in simple words

Imagine a care centre for children and adults with autism. Every day, the staff there help
each person with things like eating, dressing, speaking, and learning. Right now, most centres
write these notes on paper or in scattered files. Nobody can easily look back and answer a
simple question: **"Is this child actually getting better over the last three months?"**

This project builds an app that solves that.

**Three things the app does:**

1. **It stores the daily record properly.** Staff enter what happened today for each person —
   which activities they did, how much help they needed, what their mood was. This replaces
   paper registers.

2. **It manages the clinical process.** Doctors and psychologists use it to run assessments,
   write goals for each person ("learn to brush teeth without help by December"), and approve
   each other's work. Everyone sees only what their job allows them to see.

3. **It studies the data and gives useful signals.** This is the "Intelligent" part. After
   weeks of daily notes build up, the computer looks for patterns and tells the doctor three
   things:
   - *Is this person improving, staying the same, or getting worse?*
   - *Has something suddenly gone wrong compared to how this person normally is?*
   - *Is this person at higher risk of a difficult incident in the coming week?*

**Six types of users** will log in, each seeing different things: the Administrator,
the Care Coordinator, the Psychologist, the Head of the medical team, the Support Staff who
work with the person daily, and the Parent.

---

## 2. Where the project stands today

| | |
|---|---|
| **Planning and design** | Finished |
| **Building the software** | Just started — 3 small tasks done out of 12 in the first stage |
| **Overall project** | Stage 0 of 10 |

In simple terms: **the blueprint is complete, and construction has just begun.**

---

## 3. What was done today

### Part A — Planning the whole system (finished)

Before writing any code, a complete design document was written and approved. Think of it as
the architect's blueprint before building a house. It decides everything in advance so we
don't have to keep changing our minds later.

The design document contains:

- **22 tables of information** the app will store — details of each person in care, the staff,
  the assessments, the daily activity records, the goals, the incidents, and so on.
  (A "table" is like one sheet in an Excel file, with fixed columns.)
- **6 types of users**, and a chart showing exactly what each type is allowed to see and do.
  For example, a support staff member can only open the files of people assigned to them —
  not everyone in the centre. This protects privacy.
- **4 complete processes**, written out step by step. For example: how a new person is
  admitted, gets assigned a care team, gets assessed, and finally gets an active care plan.
- **The full list of app features** the phone and computer screens will be able to use.
- **How the intelligence part will work** — which calculations will be used to judge whether
  someone is improving, and how the risk warning will be produced.

### Part B — Turning the plan into a step-by-step task list (finished)

The design was then broken down into a working checklist for the first stage:
**12 tasks, divided into 84 small steps.**

Each step says exactly what to do, what command to run, and what result proves it worked.
This means work can continue without confusion, and a teammate can pick up any step.

### Part C — Starting the actual software (3 of 12 tasks done)

**Task 1 — Setting up the database.**
The database is where all the information will live. It was created and then tested to make
sure it genuinely works — that the app can connect to it, and that it has permission to create
tables. These checks were done deliberately, because a problem here would have caused a
confusing failure much later.

**Task 2 — Setting up the project foundation.**
The programming tools were installed and configured. An automatic rule was added that **stops
the project from building if a programmer writes passwords or settings in the wrong place.**
This means mistakes are caught by the computer, not left to be noticed by a human.

**Task 3 — Building the settings module (first real working code).**
This is the part of the app that reads its own settings, such as the database address and
security keys. It checks that every setting is present and correct, and refuses to start if
anything is wrong — with a clear message saying exactly what is missing.

This part was built using **test-first programming**: the tests were written *before* the code.
It works like writing the exam questions before writing the answers — you cannot fool yourself
into thinking the code works. **7 tests were written first, and all 7 now pass.**

---

## 4. Proof that it works

Every claim in this report was checked by actually running the software. This is the real
output from the computer:

```
$ bun run test          <-- runs all the automatic tests

 7 pass
 0 fail
Ran 7 tests across 1 file. [21 milliseconds]

$ bun run check         <-- checks code quality, formatting and errors

All checks passed.
exit code: 0            <-- "0" means no problems found
```

---

## 5. Good practices being followed

These are professional software habits being used in this project, and why they matter:

| Practice | What it means in simple words |
|---|---|
| Design before coding | The full plan was written and approved before any code, so we don't build the wrong thing |
| Test-first programming | Tests are written before the code, so we can prove the code is correct instead of hoping |
| Organised structure | The code is divided into clear layers, each with one job, so it stays easy to understand |
| Automatic quality checks | One command checks the whole project for errors before anything is saved |
| Rules enforced by the computer | Important rules are built into the tools, so breaking them stops the build automatically |
| Proper version control | 7 saved versions so far, each with a clear note explaining what changed and why |
| Password safety | Passwords and secret keys are blocked from ever being uploaded online — and this was tested |
| Written decisions | Every time we changed our approach, the reason was written down |

---

## 6. What is NOT built yet

*Written honestly, so the progress is not misunderstood.*

**This project is at the beginning of construction, not near completion.**

These parts are fully planned but not yet built:

- The database tables are designed but not yet created
- There are no screens or user interface yet
- Login and passwords are designed but not built
- The intelligent (machine learning) part has no code yet
- The parent mobile app has not been started

**Two important promises made in the design document:**

**First — all data used will be artificial.** Real medical records of real people will never be
used. The intelligent part will be trained on made-up data created by us. This means when we
show accuracy figures, those figures prove that our *system works correctly* — they do **not**
prove the app can predict what will happen to a real child. This limitation will be clearly
written in the final report and stated during the demonstration.

**Second — the computer will never make decisions about a person.** It only shows information
to a doctor, who then decides. The app cannot change a care plan, close a goal, or send a
message to a parent on its own. A human is always in control.

---

## 7. The full project roadmap

| Stage | What gets built | Status |
|---|---|---|
| 0 | Foundation — database, settings, basic setup | **Working on it now** |
| 1 | Login and user accounts | Planned |
| 2 | Adding people in care and assigning staff to them | Planned |
| 3 | Assessments and care plans with goals | Planned |
| 4 | Daily activity records, designed to work on a mobile phone | Planned |
| 5 | Calendar, rooms, incident reports, alerts | Planned |
| 6 | Creating practice data and building the intelligent part | Planned |
| 7 | Showing progress graphs and risk warnings in the app | Planned |
| 8 | Mobile app for parents | Planned |
| 9 | Final testing, diagrams and demonstration | Planned |

---

## 8. Record of work saved (version history)

Each row is one saved version of the project, stored online with a note explaining it.

| Version | What was saved |
|---|---|
| 1 | Project created online |
| 2 | Complete design document |
| 3 | Settings so the project works the same on every computer |
| 4 | The 12-task, 84-step work plan |
| 5 | Database connection settings |
| 6 | Programming tools set up |
| 7 | Settings module with its 7 tests |

---

## 9. What happens next

The remaining 9 tasks of Stage 0 will be completed: creating all 22 database tables, getting
the server to run, and writing a script that fills the database with sample data so every
screen has something to show.

**Stage 0 will be complete when:** the server runs, responds correctly when checked, and the
entire database can be rebuilt from scratch with a single command.

---

*Every number in this report was checked against the actual project files before writing.*
