import { describe, expect, it } from "bun:test";
import {
  advanceResidentStatus,
  closeIncident,
  createAdlLog,
  markAllNotificationsRead,
  reportIncident,
  reviewAdlLog,
  reviewAssessment,
  reviewIepGoal,
  reviewIncident,
  submitAssessment,
} from "@/lib/domain/mutations";
import { TODAY, freshDb, viewer } from "./helpers";

const todayIso = TODAY.toISOString().slice(0, 10);

describe("advanceResidentStatus", () => {
  it("moves IMPORTED → ENROLLED and writes a history row", () => {
    const db = freshDb();
    const csc = viewer(db, "u-csc1");
    const before = db.statusHistory.length;
    const result = advanceResidentStatus(db, csc, {
      residentId: "r-01",
      toStatus: "ENROLLED",
      reason: "Documents verified",
    });
    expect(result.error).toBeUndefined();
    expect(result.db.residents.find((r) => r.id === "r-01")?.status).toBe(
      "ENROLLED",
    );
    expect(result.db.statusHistory.length).toBe(before + 1);
    // The input is never mutated.
    expect(db.residents.find((r) => r.id === "r-01")?.status).toBe("IMPORTED");
  });

  it("refuses an illegal jump", () => {
    const db = freshDb();
    const result = advanceResidentStatus(db, viewer(db, "u-csc1"), {
      residentId: "r-01",
      toStatus: "ACTIVE",
      reason: "",
    });
    expect(result.error).toBeDefined();
    expect(result.db).toBe(db);
  });

  it("refuses a PSS", () => {
    const db = freshDb();
    const result = advanceResidentStatus(db, viewer(db, "u-pss1"), {
      residentId: "r-01",
      toStatus: "ENROLLED",
      reason: "",
    });
    expect(result.error).toBeDefined();
  });

  it("assigns the CSC when moving to CSC_ASSIGNED", () => {
    const db = freshDb();
    const result = advanceResidentStatus(db, viewer(db, "u-csc2"), {
      residentId: "r-03",
      toStatus: "CSC_ASSIGNED",
      reason: "",
    });
    expect(result.error).toBeUndefined();
    expect(
      result.db.staffAssignments.some(
        (a) => a.residentId === "r-03" && a.userId === "u-csc2" && a.role === "CSC",
      ),
    ).toBe(true);
  });
});

describe("createAdlLog", () => {
  function firstAssignmentOf(db: ReturnType<typeof freshDb>, pssId: string) {
    const residentIds = new Set(
      db.staffAssignments
        .filter((a) => a.userId === pssId && a.role === "PSS")
        .map((a) => a.residentId),
    );
    const assignment = db.adlAssignments.find((a) =>
      residentIds.has(a.residentId),
    );
    if (!assignment) throw new Error("no assignment");
    return assignment;
  }

  it("records a submitted log for an assigned resident", () => {
    const db = freshDb();
    const pss = viewer(db, "u-pss1");
    const assignment = firstAssignmentOf(db, pss.id);
    const result = createAdlLog(db, pss, {
      adlAssignmentId: assignment.id,
      logDate: todayIso,
      shift: "MORNING",
      status: "DONE",
      promptLevel: "VERBAL",
      mood: "CALM",
      notes: null,
    });
    expect(result.error).toBeUndefined();
    const created = result.db.adlLogs.at(-1);
    expect(created?.approvalStatus).toBe("SUBMITTED");
    expect(created?.loggedByUserId).toBe(pss.id);
  });

  it("rejects a second log for the same assignment, date and shift", () => {
    const db = freshDb();
    const pss = viewer(db, "u-pss1");
    const assignment = firstAssignmentOf(db, pss.id);
    const args = {
      adlAssignmentId: assignment.id,
      logDate: todayIso,
      shift: "MORNING" as const,
      status: "DONE" as const,
      promptLevel: null,
      mood: null,
      notes: null,
    };
    const first = createAdlLog(db, pss, args);
    const second = createAdlLog(first.db, pss, args);
    expect(second.error).toMatch(/already/i);
  });

  it("refuses a PSS logging for a resident they are not assigned to", () => {
    const db = freshDb();
    const pss1 = viewer(db, "u-pss1");
    const other = firstAssignmentOf(db, "u-pss2");
    const pss1Residents = new Set(
      db.staffAssignments
        .filter((a) => a.userId === pss1.id)
        .map((a) => a.residentId),
    );
    expect(pss1Residents.has(other.residentId)).toBe(false);
    const result = createAdlLog(db, pss1, {
      adlAssignmentId: other.id,
      logDate: todayIso,
      shift: "MORNING",
      status: "DONE",
      promptLevel: null,
      mood: null,
      notes: null,
    });
    expect(result.error).toBeDefined();
  });
});

describe("reviewAdlLog", () => {
  it("requires a reason to reject and notifies the logger", () => {
    const db = freshDb();
    const csc = viewer(db, "u-csc1");
    const pending = db.adlLogs.find((l) => l.approvalStatus === "SUBMITTED");
    expect(pending).toBeDefined();

    const noReason = reviewAdlLog(db, csc, {
      logId: pending!.id,
      decision: "REJECT",
      reason: "  ",
    });
    expect(noReason.error).toBeDefined();

    const rejected = reviewAdlLog(db, csc, {
      logId: pending!.id,
      decision: "REJECT",
      reason: "Mood missing",
    });
    expect(rejected.error).toBeUndefined();
    expect(
      rejected.db.notifications.some(
        (n) =>
          n.userId === pending!.loggedByUserId && n.type === "ADL_LOG_REJECTED",
      ),
    ).toBe(true);
  });
});

describe("IEP goal review", () => {
  const PLAN = "iep-r08-v1";

  it("requires a reason to reject a goal", () => {
    const db = freshDb();
    const goal = db.iepGoals.find((g) => g.iepPlanId === PLAN)!;
    const result = reviewIepGoal(db, viewer(db, "u-mdt"), {
      goalId: goal.id,
      decision: "REJECT",
      reason: "",
    });
    expect(result.error).toBeDefined();
  });

  it("approves the plan and the resident once every goal is decided with at least one approved", () => {
    let db = freshDb();
    const mdt = viewer(db, "u-mdt");
    const goals = db.iepGoals.filter((g) => g.iepPlanId === PLAN);
    expect(goals.length).toBeGreaterThan(1);

    goals.forEach((goal, index) => {
      const result = reviewIepGoal(db, mdt, {
        goalId: goal.id,
        decision: index === 0 ? "REJECT" : "APPROVE",
        reason: index === 0 ? "Too broad" : "",
      });
      expect(result.error).toBeUndefined();
      db = result.db;
    });

    expect(db.iepPlans.find((p) => p.id === PLAN)?.status).toBe("APPROVED_IEP");
    expect(db.residents.find((r) => r.id === "r-08")?.status).toBe(
      "IEP_APPROVED",
    );
  });

  it("rejects the plan when every goal is rejected", () => {
    let db = freshDb();
    const mdt = viewer(db, "u-mdt");
    for (const goal of db.iepGoals.filter((g) => g.iepPlanId === PLAN)) {
      db = reviewIepGoal(db, mdt, {
        goalId: goal.id,
        decision: "REJECT",
        reason: "Rework",
      }).db;
    }
    expect(db.iepPlans.find((p) => p.id === PLAN)?.status).toBe("REJECTED_IEP");
    expect(db.residents.find((r) => r.id === "r-08")?.status).toBe(
      "IEP_IN_PROGRESS",
    );
  });
});

describe("assessment review", () => {
  it("lets the MDT head approve a submitted assessment but not its author", () => {
    const db = freshDb();
    const submitted = db.assessments.find((a) => a.status === "SUBMITTED")!;
    const byAuthor = reviewAssessment(
      db,
      viewer(db, submitted.assignedToUserId),
      { assessmentId: submitted.id, decision: "APPROVE", notes: "" },
    );
    expect(byAuthor.error).toBeDefined();

    const byMdt = reviewAssessment(db, viewer(db, "u-mdt"), {
      assessmentId: submitted.id,
      decision: "APPROVE",
      notes: "",
    });
    expect(byMdt.error).toBeUndefined();
    expect(
      byMdt.db.assessments.find((a) => a.id === submitted.id)?.status,
    ).toBe("APPROVED");
  });

  it("completes the resident's assessments once the last one is approved", () => {
    let db = freshDb();
    const psych = viewer(db, "u-psych1");
    const mdt = viewer(db, "u-mdt");
    // r-05 has one assessment in progress and one submitted.
    for (const a of db.assessments.filter(
      (x) => x.residentId === "r-05" && x.status === "IN_PROGRESS",
    )) {
      db = submitAssessment(db, psych, {
        assessmentId: a.id,
        items: [{ item: "Eye contact", rating: 3 }],
        summary: "Done",
      }).db;
    }
    for (const a of db.assessments.filter(
      (x) => x.residentId === "r-05" && x.status === "SUBMITTED",
    )) {
      db = reviewAssessment(db, mdt, {
        assessmentId: a.id,
        decision: "APPROVE",
        notes: "",
      }).db;
    }
    expect(db.residents.find((r) => r.id === "r-05")?.status).toBe(
      "ASSESSMENTS_COMPLETED",
    );
  });
});

describe("incidents", () => {
  it("notifies the care team and, when flagged, the parent", () => {
    const db = freshDb();
    const pss = viewer(db, "u-pss1");
    const residentId = db.staffAssignments.find(
      (a) =>
        a.userId === pss.id &&
        db.residentParents.some((p) => p.residentId === a.residentId),
    )!.residentId;
    const parentId = db.residentParents.find(
      (p) => p.residentId === residentId,
    )!.parentUserId;

    const result = reportIncident(db, pss, {
      residentId,
      type: "FALL",
      severity: "HIGH",
      occurredAt: TODAY.toISOString(),
      location: "Garden",
      description: "Slipped on wet grass",
      notifyParent: true,
    });
    expect(result.error).toBeUndefined();
    const incident = result.db.incidents.at(-1)!;
    expect(incident.status).toBe("REPORTED");
    const notified = new Set(
      result.db.notifications
        .filter((n) => n.entityId === incident.id)
        .map((n) => n.userId),
    );
    expect(notified.has(parentId)).toBe(true);
    expect(notified.has(pss.id)).toBe(false);
    expect(notified.size).toBeGreaterThan(1);
  });

  it("escalation forces critical severity and notifies every super admin", () => {
    let db = freshDb();
    const mdt = viewer(db, "u-mdt");
    const reported = db.incidents.find((i) => i.status === "REPORTED")!;
    db = reviewIncident(db, mdt, { incidentId: reported.id, action: "START_REVIEW" }).db;
    const result = reviewIncident(db, mdt, {
      incidentId: reported.id,
      action: "ESCALATE",
    });
    expect(result.error).toBeUndefined();
    const incident = result.db.incidents.find((i) => i.id === reported.id)!;
    expect(incident.status).toBe("ESCALATED");
    expect(incident.severity).toBe("CRITICAL_INTERRUPT");
    expect(
      result.db.notifications.some(
        (n) => n.userId === "u-admin" && n.type === "INCIDENT_ESCALATED",
      ),
    ).toBe(true);
  });

  it("requires a resolution and only closes resolved incidents", () => {
    let db = freshDb();
    const mdt = viewer(db, "u-mdt");
    const csc = viewer(db, "u-csc1");
    const reported = db.incidents.find((i) => i.status === "REPORTED")!;
    db = reviewIncident(db, mdt, { incidentId: reported.id, action: "START_REVIEW" }).db;

    expect(closeIncident(db, csc, { incidentId: reported.id }).error).toBeDefined();
    expect(
      reviewIncident(db, mdt, { incidentId: reported.id, action: "RESOLVE" }).error,
    ).toBeDefined();

    db = reviewIncident(db, mdt, {
      incidentId: reported.id,
      action: "RESOLVE",
      resolution: "Reviewed with family",
    }).db;
    const closed = closeIncident(db, csc, { incidentId: reported.id });
    expect(closed.error).toBeUndefined();
    expect(closed.db.incidents.find((i) => i.id === reported.id)?.status).toBe(
      "CLOSED",
    );
  });
});

describe("notifications", () => {
  it("marks only the viewer's own notifications read", () => {
    const db = freshDb();
    const csc = viewer(db, "u-csc1");
    const result = markAllNotificationsRead(db, csc, {});
    expect(
      result.db.notifications.filter((n) => n.userId === csc.id && !n.readAt),
    ).toHaveLength(0);
    const othersUnreadBefore = db.notifications.filter(
      (n) => n.userId !== csc.id && !n.readAt,
    ).length;
    const othersUnreadAfter = result.db.notifications.filter(
      (n) => n.userId !== csc.id && !n.readAt,
    ).length;
    expect(othersUnreadAfter).toBe(othersUnreadBefore);
  });
});
