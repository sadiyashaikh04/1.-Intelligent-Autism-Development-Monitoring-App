import { describe, expect, it } from "bun:test";
import {
  activateIepPlan,
  advanceResidentStatus,
  createAdlLog,
  logGoalProgress,
  reviewAdlLog,
  reviewIepGoal,
  scheduleAssessment,
  startAssessment,
} from "@/lib/domain/mutations";
import { listAdlAssignments, listAssessments } from "@/lib/domain/queries";
import { TODAY, freshDb, viewer } from "./helpers";

const todayIso = TODAY.toISOString().slice(0, 10);
const tomorrow10 = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0); // clear of every seeded slot
  return d.toISOString();
};

describe("final-review fixes", () => {
  it("activating a plan gives the resident ADL activities their PSS can log", () => {
    let db = freshDb();
    const mdt = viewer(db, "u-mdt");
    for (const g of db.iepGoals.filter((x) => x.iepPlanId === "iep-r08-v1")) {
      db = reviewIepGoal(db, mdt, { goalId: g.id, decision: "APPROVE", reason: "" }).db;
    }
    const result = activateIepPlan(db, viewer(db, "u-csc2"), { planId: "iep-r08-v1" });
    expect(result.error).toBeUndefined();
    expect(listAdlAssignments(result.db, viewer(result.db, "u-pss3"), "r-08").length).toBeGreaterThan(0);
  });

  it("refuses to schedule with a psychologist who is not on the care team", () => {
    const db = freshDb();
    const result = scheduleAssessment(db, viewer(db, "u-csc1"), {
      residentId: "r-04",
      assessmentTypeId: "at-beh-obs",
      assignedToUserId: "u-psych2", // r-04's team psychologist is psych1
      roomId: "room-aa",
      startsAt: tomorrow10(),
    });
    expect(result.error).toMatch(/care team/i);
  });

  it("a scheduled assessment is visible to the clinician it was booked with", () => {
    const db = freshDb();
    const result = scheduleAssessment(db, viewer(db, "u-csc1"), {
      residentId: "r-04",
      assessmentTypeId: "at-beh-obs",
      assignedToUserId: "u-psych1",
      roomId: "room-aa",
      startsAt: tomorrow10(),
    });
    expect(result.error).toBeUndefined();
    const mine = listAssessments(result.db, viewer(result.db, "u-psych1")).map((r) => r.assessment.id);
    expect(mine).toContain(result.createdId!);
  });

  it("startAssessment also enforces resident scoping", () => {
    const db = freshDb();
    // Reassign r-06's scheduled assessment to psych1, who is not on r-06's team.
    const a = db.assessments.find((x) => x.residentId === "r-06" && x.status === "SCHEDULED")!;
    a.assignedToUserId = "u-psych1";
    expect(startAssessment(db, viewer(db, "u-psych1"), { assessmentId: a.id }).error).toBeDefined();
  });

  it("a PSS can resubmit a log the CSC returned", () => {
    let db = freshDb();
    const pending = db.adlLogs.find((l) => l.approvalStatus === "SUBMITTED" && l.loggedByUserId === "u-pss1")!;
    db = reviewAdlLog(db, viewer(db, "u-csc1"), { logId: pending.id, decision: "REJECT", reason: "Mood missing" }).db;
    const again = createAdlLog(db, viewer(db, "u-pss1"), {
      adlAssignmentId: pending.adlAssignmentId,
      logDate: pending.logDate,
      shift: pending.shift,
      status: "DONE",
      promptLevel: "VERBAL",
      mood: "CALM",
      notes: null,
    });
    expect(again.error).toBeUndefined();
    const rows = again.db.adlLogs.filter(
      (l) => l.adlAssignmentId === pending.adlAssignmentId && l.logDate === pending.logDate && l.shift === pending.shift,
    );
    // Still one row per (assignment, date, shift) — the rejected one is replaced.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.approvalStatus).toBe("SUBMITTED");
    expect(rows[0]?.mood).toBe("CALM");
  });

  it("rejects an ADL log with no date or a future date", () => {
    const db = freshDb();
    const pss = viewer(db, "u-pss1");
    const assignment = listAdlAssignments(db, pss)[0]!.assignment;
    const base = { adlAssignmentId: assignment.id, shift: "MORNING" as const, status: "DONE" as const, promptLevel: null, mood: null, notes: null };
    expect(createAdlLog(db, pss, { ...base, logDate: "" }).error).toBeDefined();
    expect(createAdlLog(db, pss, { ...base, logDate: "2999-01-01" }).error).toBeDefined();
    expect(createAdlLog(db, pss, { ...base, logDate: todayIso }).error).toBeUndefined();
  });

  it("a PSS cannot log progress on a clinician-led goal", () => {
    const db = freshDb();
    const pss = viewer(db, "u-pss1");
    const clinicianGoal = db.iepGoals.find(
      (g) => g.iepPlanId === "iep-r-09-v1" && g.assignedRole === "CLINICIAN",
    );
    expect(clinicianGoal).toBeDefined();
    const result = logGoalProgress(db, pss, {
      goalId: clinicianGoal!.id,
      logDate: todayIso,
      outcome: "ACHIEVED_LOG",
      promptLevel: null,
      notes: null,
    });
    expect(result.error).toBeDefined();
  });

  it("refuses a care team whose members do not have the right roles", () => {
    let db = freshDb();
    const csc = viewer(db, "u-csc1");
    db = advanceResidentStatus(db, csc, { residentId: "r-03", toStatus: "CSC_ASSIGNED", reason: "" }).db;
    expect(db.residents.find((r) => r.id === "r-03")?.status).toBe("CSC_ASSIGNED");
    const good = advanceResidentStatus(db, csc, {
      residentId: "r-03",
      toStatus: "MDT_ASSIGNED",
      reason: "",
      team: { psychologistId: "u-psych1", pssId: "u-pss1" },
    });
    expect(good.error).toBeUndefined();
    const result = advanceResidentStatus(db, csc, {
      residentId: "r-03",
      toStatus: "MDT_ASSIGNED",
      reason: "",
      team: { psychologistId: "u-pss1", pssId: "u-psych1" },
    });
    expect(result.error).toBeDefined();
  });
});
