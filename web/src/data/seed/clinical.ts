import type {
  Assessment,
  AssessmentStatus,
  DemoDb,
  IepGoal,
  IepPlan,
} from "@/data/types";
import { ASSESSMENT_ITEMS, GOAL_TEMPLATES } from "./catalogues";
import { ACTIVE_RESIDENT_IDS } from "./people";
import { at, createRandom, dateOffset } from "./helpers";

type Plan = [
  residentId: string,
  typeId: string,
  psych: string,
  status: AssessmentStatus,
  daysAgo: number,
];

function psychOf(db: Pick<DemoDb, "staffAssignments">, residentId: string) {
  return db.staffAssignments.find(
    (a) => a.residentId === residentId && a.role === "JR_PSYCHOLOGIST",
  )!.userId;
}

export function buildAssessments(
  today: Date,
  db: Pick<DemoDb, "staffAssignments">,
): Assessment[] {
  const rand = createRandom(11);
  const plans: Plan[] = [
    ["r-05", "at-beh-obs", "u-psych1", "APPROVED", 18],
    ["r-05", "at-cog-prof", "u-psych1", "SUBMITTED", 6],
    ["r-05", "at-comm-expr", "u-psych1", "IN_PROGRESS", 2],
    ["r-06", "at-sens-prof", "u-psych2", "SCHEDULED", -1],
    ["r-06", "at-comm-recp", "u-psych2", "REVISION_REQUESTED", 7],
    ["r-07", "at-beh-obs", "u-psych1", "APPROVED", 30],
    ["r-07", "at-motor-skl", "u-psych1", "APPROVED", 26],
    ["r-08", "at-comm-expr", "u-psych2", "APPROVED", 48],
    ["r-08", "at-sens-prof", "u-psych2", "APPROVED", 44],
  ];
  for (const id of ACTIVE_RESIDENT_IDS) {
    plans.push([id, "at-beh-obs", psychOf(db, id), "APPROVED", 110]);
    plans.push([id, "at-comm-expr", psychOf(db, id), "APPROVED", 105]);
  }

  return plans.map(([residentId, typeId, psych, status, daysAgo], index) => {
    const hasFindings = ["SUBMITTED", "APPROVED", "REVISION_REQUESTED"].includes(
      status,
    );
    const items = (ASSESSMENT_ITEMS[typeId] ?? []).map((item) => ({
      item,
      rating: 1 + Math.floor(rand() * 5),
    }));
    const score = hasFindings
      ? Math.round(
          (items.reduce((sum, i) => sum + i.rating, 0) / (items.length * 5)) *
            100,
        )
      : null;
    return {
      id: `a-${residentId.slice(2)}-${index}`,
      residentId,
      assessmentTypeId: typeId,
      assignedToUserId: psych,
      status,
      scheduledAt: at(today, -daysAgo, 10),
      calendarSlotId: status === "SCHEDULED" ? "slot-assess-r06" : null,
      findings: hasFindings
        ? {
            items,
            summary:
              "Observed across two sessions. Responds well to visual supports and predictable routines.",
          }
        : null,
      score,
      submittedAt: hasFindings ? at(today, -daysAgo + 1, 16) : null,
      reviewedByUserId:
        status === "APPROVED" || status === "REVISION_REQUESTED" ? "u-mdt" : null,
      reviewNotes:
        status === "REVISION_REQUESTED"
          ? "Please add observations from the classroom setting before resubmitting."
          : null,
      createdAt: at(today, -daysAgo - 3, 9),
    };
  });
}

/** Goal templates per resident, rotated so residents differ. */
function goalsFor(residentIndex: number) {
  const n = GOAL_TEMPLATES.length;
  return [0, 2, 5].map((offset) => GOAL_TEMPLATES[(residentIndex * 3 + offset) % n]!);
}

export function buildIep(
  today: Date,
  db: Pick<DemoDb, "staffAssignments">,
): { iepPlans: IepPlan[]; iepGoals: IepGoal[] } {
  const iepPlans: IepPlan[] = [];
  const iepGoals: IepGoal[] = [];

  // r-08: a submitted plan waiting for the MDT head's goal-by-goal review.
  iepPlans.push({
    id: "iep-r08-v1",
    residentId: "r-08",
    version: 1,
    status: "SUBMITTED_IEP",
    authoredByUserId: "u-psych2",
    submittedAt: at(today, -2, 15),
    approvedByUserId: null,
    approvedAt: null,
    startDate: null,
    endDate: null,
    createdAt: at(today, -9, 10),
  });
  goalsFor(7).forEach((g, i) =>
    iepGoals.push({
      id: `g-r08-${i}`,
      iepPlanId: "iep-r08-v1",
      ...g,
      status: "NOT_STARTED",
      approvalStatus: "PENDING_MDT_APPROVAL",
      rejectionReason: null,
    }),
  );

  ACTIVE_RESIDENT_IDS.forEach((residentId, index) => {
    const planId = `iep-${residentId}-v1`;
    iepPlans.push({
      id: planId,
      residentId,
      version: 1,
      status: "ACTIVE_IEP",
      authoredByUserId: psychOf(db, residentId),
      submittedAt: at(today, -95, 15),
      approvedByUserId: "u-mdt",
      approvedAt: at(today, -90, 12),
      startDate: dateOffset(today, -88),
      endDate: dateOffset(today, 92),
      createdAt: at(today, -100, 10),
    });
    goalsFor(index).forEach((g, i) =>
      iepGoals.push({
        id: `g-${residentId}-${i}`,
        iepPlanId: planId,
        ...g,
        status: "IN_PROGRESS_GOAL",
        approvalStatus: "APPROVED_MDT",
        rejectionReason: null,
      }),
    );
  });

  return { iepPlans, iepGoals };
}
