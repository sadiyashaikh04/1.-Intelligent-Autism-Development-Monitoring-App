import type {
  AdlAssignment,
  AdlLog,
  AdlMood,
  CalendarSlot,
  DemoDb,
  GoalProgressLog,
  Incident,
  IepLogOutcome,
  Notification,
  PromptLevel,
} from "@/data/types";
import { ACTIVE_RESIDENT_IDS } from "./people";
import {
  addDays,
  at,
  createRandom,
  dateOffset,
  pick,
  startOfWeek,
} from "./helpers";

/**
 * Planted behavioural patterns (parent spec §9.2, scaled down). Synthetic:
 * these exist so the insights screens have something true to show.
 */
export type Pattern = "improving" | "declining" | "stable" | "new";
export const PATTERNS: Record<string, Pattern> = {
  "r-09": "improving",
  "r-10": "declining",
  "r-11": "stable",
  "r-12": "improving",
  "r-13": "stable", // one domain declines — see insights.ts
  "r-14": "stable",
  "r-15": "improving",
  "r-16": "new",
};

const PROMPTS: PromptLevel[] = [
  "FULL_PHYSICAL",
  "PARTIAL_PHYSICAL",
  "GESTURAL",
  "VERBAL",
  "INDEPENDENT",
];

/** 0..1 ability on a given day (days < 0 are in the past). */
export function abilityOn(pattern: Pattern, daysAgo: number): number {
  const t = (28 - daysAgo) / 28; // 0 four weeks ago → 1 today
  switch (pattern) {
    case "improving":
      return 0.5 + 0.3 * t;
    case "declining":
      return daysAgo <= 14 ? 0.72 - 0.3 * ((14 - daysAgo) / 14) : 0.72;
    case "new":
      return 0.45 + 0.05 * t;
    default:
      return 0.62;
  }
}

function teamMember(
  db: Pick<DemoDb, "staffAssignments">,
  residentId: string,
  role: "CSC" | "PSS" | "JR_PSYCHOLOGIST" | "MDT_HEAD",
) {
  return db.staffAssignments.find(
    (a) => a.residentId === residentId && a.role === role,
  )!.userId;
}

const ROTATION = ["ad-feed", "ad-dress", "ad-oral", "ad-groom", "ad-toilet", "ad-money", "ad-meal", "ad-bath"];

export function buildAdlAssignments(
  db: Pick<DemoDb, "staffAssignments">,
): AdlAssignment[] {
  const out: AdlAssignment[] = [];
  ACTIVE_RESIDENT_IDS.forEach((residentId, index) => {
    for (let k = 0; k < 4; k++) {
      const activityId = ROTATION[(index + k * 2) % ROTATION.length]!;
      out.push({
        id: `aa-${residentId}-${activityId}`,
        residentId,
        adlActivityId: activityId,
        assignedByUserId: teamMember(db, residentId, "CSC"),
        frequency: "DAILY",
        isActive: true,
      });
    }
  });
  return out;
}

function moodFor(rand: () => number, pattern: Pattern, daysAgo: number): AdlMood {
  const r = rand();
  if (pattern === "declining" && daysAgo <= 14) {
    if (r < 0.12) return "MELTDOWN";
    if (r < 0.34) return "ESCALATED";
    if (r < 0.6) return "ANXIOUS";
    return "CALM";
  }
  if (r < 0.01) return "MELTDOWN";
  if (r < 0.06) return "ESCALATED";
  if (r < 0.24) return "ANXIOUS";
  return "CALM";
}

export function buildAdlLogs(
  today: Date,
  db: Pick<DemoDb, "staffAssignments" | "adlAssignments">,
): AdlLog[] {
  const rand = createRandom(7);
  const logs: AdlLog[] = [];
  for (const assignment of db.adlAssignments) {
    const pattern = PATTERNS[assignment.residentId] ?? "stable";
    const days = pattern === "new" ? 21 : 28;
    const pss = teamMember(db, assignment.residentId, "PSS");
    const csc = teamMember(db, assignment.residentId, "CSC");
    for (let daysAgo = days; daysAgo >= 1; daysAgo--) {
      const date = addDays(today, -daysAgo);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      // Realistic missingness: ~12% absent, thinner weekend coverage.
      if (rand() < (weekend ? 0.35 : 0.12)) continue;
      const ability = abilityOn(pattern, daysAgo);
      const done = rand() < ability + 0.1;
      const promptIndex = Math.max(
        0,
        Math.min(4, Math.round(ability * 4 + (rand() - 0.5) * 1.5)),
      );
      const pending = daysAgo === 1 && rand() < 0.6;
      logs.push({
        id: `al-${assignment.id}-${daysAgo}`,
        adlAssignmentId: assignment.id,
        loggedByUserId: pss,
        logDate: dateOffset(today, -daysAgo),
        shift: "MORNING",
        status: done ? "DONE" : rand() < 0.5 ? "IN_PROGRESS_ADL" : "TODO",
        promptLevel: PROMPTS[promptIndex]!,
        mood: moodFor(rand, pattern, daysAgo),
        notes: rand() < 0.15 ? "Needed extra time today." : null,
        approvalStatus: pending ? "SUBMITTED" : "APPROVED",
        approvedByUserId: pending ? null : csc,
        rejectionReason: null,
        createdAt: at(today, -daysAgo, 11, 30),
      });
    }
  }
  return logs;
}

export function buildGoalProgressLogs(
  today: Date,
  db: Pick<DemoDb, "staffAssignments" | "iepGoals" | "iepPlans">,
): GoalProgressLog[] {
  const rand = createRandom(23);
  const logs: GoalProgressLog[] = [];
  for (const goal of db.iepGoals) {
    const plan = db.iepPlans.find((p) => p.id === goal.iepPlanId)!;
    if (plan.status !== "ACTIVE_IEP") continue;
    const pattern = PATTERNS[plan.residentId] ?? "stable";
    const logger =
      goal.assignedRole === "PSS"
        ? teamMember(db, plan.residentId, "PSS")
        : teamMember(db, plan.residentId, "JR_PSYCHOLOGIST");
    const step = goal.frequency === "DAILY" ? 2 : 7;
    for (let daysAgo = 28; daysAgo >= 1; daysAgo -= step) {
      if (pattern === "new" && daysAgo > 21) continue;
      const ability = abilityOn(pattern, daysAgo);
      const r = rand();
      const outcome: IepLogOutcome =
        r < ability - 0.15
          ? "ACHIEVED_LOG"
          : r < ability + 0.2
            ? "PARTIALLY_ACHIEVED_LOG"
            : "NOT_ACHIEVED_LOG";
      logs.push({
        id: `gp-${goal.id}-${daysAgo}`,
        iepGoalId: goal.id,
        loggedByUserId: logger,
        logDate: dateOffset(today, -daysAgo),
        outcome,
        promptLevel: pick(rand, PROMPTS.slice(Math.round(ability * 2))),
        notes: null,
        createdAt: at(today, -daysAgo, 15),
      });
    }
  }
  return logs;
}

export function buildIncidents(today: Date): Incident[] {
  const base = {
    reviewedByUserId: null,
    resolution: null,
    resolvedAt: null,
  };
  return [
    { ...base, id: "i-01", residentId: "r-10", reportedByUserId: "u-pss2", type: "MELTDOWN", status: "REPORTED", severity: "HIGH", occurredAt: at(today, -1, 16, 20), location: "Activity Hall", description: "Became distressed when the group activity changed without warning. Calmed after 15 minutes in the quiet corner.", notifyParent: true, createdAt: at(today, -1, 16, 45) },
    { ...base, id: "i-06", residentId: "r-15", reportedByUserId: "u-pss3", type: "INJURY", status: "REPORTED", severity: "NORMAL", occurredAt: at(today, 0, 8, 10), location: "Dining area", description: "Minor scrape on the left hand from a chair edge. Cleaned and dressed.", notifyParent: false, createdAt: at(today, 0, 8, 30) },
    { ...base, id: "i-02", residentId: "r-13", reportedByUserId: "u-pss1", type: "AGGRESSION", status: "UNDER_REVIEW", severity: "HIGH", occurredAt: at(today, -3, 11, 0), location: "Classroom 1", description: "Pushed a peer during a transition between activities.", notifyParent: false, reviewedByUserId: "u-mdt", createdAt: at(today, -3, 11, 30) },
    { ...base, id: "i-03", residentId: "r-10", reportedByUserId: "u-pss2", type: "SELF_HARM", status: "ESCALATED", severity: "CRITICAL_INTERRUPT", occurredAt: at(today, -6, 19, 0), location: "Bedroom", description: "Repeated head-banging for several minutes before bedtime. Staff intervened safely.", notifyParent: true, reviewedByUserId: "u-mdt", createdAt: at(today, -6, 19, 20) },
    { ...base, id: "i-04", residentId: "r-09", reportedByUserId: "u-pss1", type: "FALL", status: "RESOLVED", severity: "NORMAL", occurredAt: at(today, -10, 9, 40), location: "Garden", description: "Slipped on wet grass. No injury.", notifyParent: true, reviewedByUserId: "u-mdt", resolution: "Garden path matting added; family informed.", resolvedAt: at(today, -9, 14) , createdAt: at(today, -10, 10) },
    { ...base, id: "i-05", residentId: "r-12", reportedByUserId: "u-pss2", type: "ELOPEMENT", status: "CLOSED", severity: "HIGH", occurredAt: at(today, -20, 15, 0), location: "Main gate", description: "Left the group at the gate during pickup; found within 3 minutes.", notifyParent: true, reviewedByUserId: "u-mdt", resolution: "Gate protocol updated; staff briefed.", resolvedAt: at(today, -18, 12), createdAt: at(today, -20, 15, 15) },
  ];
}

export function buildCalendarSlots(
  today: Date,
  db: Pick<DemoDb, "staffAssignments">,
): CalendarSlot[] {
  const slots: CalendarSlot[] = [];
  const monday = startOfWeek(today);
  const slotAt = (weekOffset: number, weekday: number, hour: number, minute = 0) => {
    const d = addDays(monday, weekOffset * 7 + weekday);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const iso = (d: Date, plusMinutes = 0) =>
    new Date(d.getTime() + plusMinutes * 60000).toISOString();

  for (const weekOffset of [-1, 0, 1]) {
    ACTIVE_RESIDENT_IDS.forEach((residentId, index) => {
      const psych = teamMember(db, residentId, "JR_PSYCHOLOGIST");
      const pss = teamMember(db, residentId, "PSS");
      for (const weekday of [1, 3]) {
        const start = slotAt(weekOffset, weekday, 9 + (index % 6), index % 2 ? 30 : 0);
        slots.push({
          id: `slot-th-${residentId}-${weekOffset}-${weekday}`,
          type: "THERAPY_SESSION",
          status: start < today ? "COMPLETED_SLOT" : "SCHEDULED_SLOT",
          startsAt: iso(start),
          endsAt: iso(start, 45),
          roomId: index % 2 ? "room-t2" : "room-t1",
          residentId,
          staffUserId: psych,
          title: "Therapy session",
          notes: null,
          createdByUserId: teamMember(db, residentId, "CSC"),
        });
      }
      for (const weekday of [0, 2, 4]) {
        const start = slotAt(weekOffset, weekday, 14 + (index % 3));
        slots.push({
          id: `slot-ipp-${residentId}-${weekOffset}-${weekday}`,
          type: "IPP_ACTIVITY",
          status: start < today ? "COMPLETED_SLOT" : "SCHEDULED_SLOT",
          startsAt: iso(start),
          endsAt: iso(start, 30),
          roomId: "room-c1",
          residentId,
          staffUserId: pss,
          title: "IEP goal practice",
          notes: null,
          createdByUserId: teamMember(db, residentId, "CSC"),
        });
      }
    });
    const teamMeeting = slotAt(weekOffset, 0, 9);
    slots.push({
      id: `slot-team-${weekOffset}`,
      type: "GENERAL_SLOT",
      status: teamMeeting < today ? "COMPLETED_SLOT" : "SCHEDULED_SLOT",
      startsAt: iso(teamMeeting),
      endsAt: iso(teamMeeting, 30),
      roomId: "room-hall",
      residentId: null,
      staffUserId: "u-csc1",
      title: "Weekly team huddle",
      notes: null,
      createdByUserId: "u-csc1",
    });
  }

  const assessStart = addDays(today, 1);
  assessStart.setHours(10, 0, 0, 0);
  slots.push({
    id: "slot-assess-r06",
    type: "ASSESSMENT_SLOT",
    status: "SCHEDULED_SLOT",
    startsAt: iso(assessStart),
    endsAt: iso(assessStart, 60),
    roomId: "room-aa",
    residentId: "r-06",
    staffUserId: "u-psych2",
    title: "Sensory Profile assessment",
    notes: null,
    createdByUserId: "u-csc1",
  });
  const meeting = slotAt(0, 4, 11);
  slots.push({
    id: "slot-ipp-meeting-r08",
    type: "IPP_MEETING_SLOT",
    status: "SCHEDULED_SLOT",
    startsAt: iso(meeting),
    endsAt: iso(meeting, 60),
    roomId: "room-cons",
    residentId: "r-08",
    staffUserId: "u-mdt",
    title: "IEP review meeting — Myra C.",
    notes: null,
    createdByUserId: "u-csc2",
  });
  return slots;
}

export function buildNotifications(today: Date): Notification[] {
  let n = 0;
  const make = (
    userId: string,
    type: Notification["type"],
    title: string,
    body: string,
    hoursAgo: number,
    read: boolean,
    entity: [string, string] | null = null,
    severity: Notification["severity"] = "NORMAL",
  ): Notification => {
    const created = new Date(today.getTime() - hoursAgo * 3600000);
    return {
      id: `n-${++n}`,
      userId,
      type,
      severity,
      title,
      body,
      entityType: entity?.[0] ?? null,
      entityId: entity?.[1] ?? null,
      readAt: read ? new Date(created.getTime() + 1800000).toISOString() : null,
      createdAt: created.toISOString(),
    };
  };
  return [
    make("u-admin", "INCIDENT_ESCALATED", "Incident escalated", "A self-harm incident for Saanvi D. was escalated by the MDT head.", 140, false, ["Incident", "i-03"], "CRITICAL_INTERRUPT"),
    make("u-csc1", "INCIDENT_REPORTED", "New incident reported", "Minor injury reported for Anika D. this morning.", 1, false, ["Incident", "i-06"]),
    make("u-csc1", "PERFORMANCE_DECLINE_DETECTED", "Decline detected", "Kiara S. shows a decline in one domain compared with her own baseline.", 20, false, ["Resident", "r-13"], "HIGH"),
    make("u-csc1", "SESSION_REMINDER", "Team huddle", "Weekly team huddle on Monday at 09:00 in the Activity Hall.", 60, true),
    make("u-csc2", "INCIDENT_REPORTED", "New incident reported", "Meltdown reported for Saanvi D. yesterday afternoon.", 17, false, ["Incident", "i-01"], "HIGH"),
    make("u-csc2", "ELEVATED_RISK_FLAGGED", "Elevated risk flagged", "Saanvi D. moved to HIGH incident risk. Review the contributing factors.", 20, false, ["Resident", "r-10"], "HIGH"),
    make("u-csc2", "INCIDENT_ESCALATED", "Incident escalated", "Self-harm incident for Saanvi D. escalated.", 140, true, ["Incident", "i-03"], "CRITICAL_INTERRUPT"),
    make("u-psych1", "SESSION_REMINDER", "Sessions today", "You have therapy sessions scheduled today. Check your calendar.", 3, false),
    make("u-psych1", "CARE_TEAM_ASSIGNED", "Added to care team", "You were assigned to Ananya B.'s care team.", 300, true, ["Resident", "r-04"]),
    make("u-psych2", "ASSESSMENT_REVISION_REQUESTED", "Revision requested", "The MDT head asked for changes to Ishita V.'s Receptive Communication assessment.", 150, false, ["Assessment", "a-06-4"], "HIGH"),
    make("u-psych2", "ASSESSMENT_SCHEDULED", "Assessment scheduled", "Sensory Profile for Ishita V. tomorrow at 10:00, Assessment Room A.", 26, false, ["Assessment", "a-06-3"]),
    make("u-mdt", "ASSESSMENT_COMPLETED", "Assessment awaiting review", "Cognitive Profile for Vivaan R. was submitted.", 120, false, ["Assessment", "a-05-1"]),
    make("u-mdt", "IEP_SUBMITTED", "IEP submitted", "Myra C.'s IEP plan v1 is waiting for goal approval.", 44, false, ["IepPlan", "iep-r08-v1"]),
    make("u-mdt", "ELEVATED_RISK_FLAGGED", "Elevated risk flagged", "Saanvi D. moved to HIGH incident risk.", 20, false, ["Resident", "r-10"], "HIGH"),
    make("u-mdt", "PERFORMANCE_DECLINE_DETECTED", "Decline detected", "Kiara S. shows a decline in one domain.", 20, true, ["Resident", "r-13"]),
    make("u-pss1", "SESSION_REMINDER", "Today's activities", "Morning ADL logs are due for your service users.", 2, false),
    make("u-pss1", "ADL_LOG_REJECTED", "ADL log returned", "A Feeding log for Reyansh P. was returned: mood was missing.", 200, true),
    make("u-pss2", "SESSION_REMINDER", "Today's activities", "Morning ADL logs are due for your service users.", 2, false),
    make("u-pss3", "CARE_TEAM_ASSIGNED", "Added to care team", "You were assigned to Shaurya I.'s care team.", 30, false, ["Resident", "r-16"]),
    make("u-parent1", "IPP_FINALIZED", "Plan update", "Reyansh's care plan goals for this term are now in place.", 50, false),
    make("u-parent1", "INCIDENT_RESOLVED", "Incident resolved", "The fall in the garden on the 5th has been reviewed. Matting has been added to the path.", 220, true),
    make("u-parent2", "INCIDENT_REPORTED", "Incident update", "Saanvi had a difficult moment yesterday afternoon. Staff supported her and she settled.", 16, false, ["Incident", "i-01"]),
    make("u-parent3", "SESSION_REMINDER", "Review meeting", "Myra's plan review meeting is on Friday at 11:00.", 8, false),
    make("u-parent4", "SESSION_REMINDER", "Assessments complete", "Aryan's assessments are complete. His care plan will be drafted next.", 90, true),
  ];
}
