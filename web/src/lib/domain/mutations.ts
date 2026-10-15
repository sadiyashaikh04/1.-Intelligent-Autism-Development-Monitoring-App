import type {
  AdlLogStatus,
  AdlMood,
  ClinicalDomain,
  DemoDb,
  FindingItem,
  GoalFrequency,
  IepAssignedRole,
  IepLogOutcome,
  IncidentType,
  Notification,
  NotificationSeverity,
  NotificationType,
  PromptLevel,
  ResidentStatus,
  Shift,
  UserRole,
  Viewer,
} from "@/data/types";
import { can, type Action } from "@/lib/domain/permissions";
import { visibleResidentIds } from "@/lib/domain/queries";
import {
  canTransitionResident,
  manualNextStatuses,
} from "@/lib/domain/transitions";

/**
 * Pure mutations: (db, viewer, args) → a NEW db, or the same db plus an
 * error. Each one checks the role (permissions.ts) and resident scoping
 * before touching anything, mirroring what the backend services will do.
 * Status changes write history; workflow steps send the notifications
 * parent spec §5 names.
 */

export interface MutationResult {
  db: DemoDb;
  error?: string;
  /** Id of the record a create-style mutation made. */
  createdId?: string;
}
export type Mutation<A> = (db: DemoDb, viewer: Viewer, args: A) => MutationResult;

const refuse = (db: DemoDb, error: string): MutationResult => ({ db, error });

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

const now = () => new Date().toISOString();
const todayDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function guard(db: DemoDb, viewer: Viewer, action: Action): MutationResult | null {
  return can(viewer.role, action)
    ? null
    : refuse(db, "Your role is not allowed to do this.");
}

function canSeeResident(db: DemoDb, viewer: Viewer, residentId: string) {
  return visibleResidentIds(db, viewer).has(residentId);
}

function residentName(db: DemoDb, residentId: string): string {
  const r = db.residents.find((x) => x.id === residentId);
  return r ? `${r.firstName} ${r.lastName.charAt(0)}.` : "a service user";
}

function notify(
  db: DemoDb,
  userIds: Iterable<string>,
  n: {
    type: NotificationType;
    title: string;
    body: string;
    severity?: NotificationSeverity;
    entityType?: string;
    entityId?: string;
  },
): void {
  for (const userId of new Set(userIds)) {
    const notification: Notification = {
      id: newId("n"),
      userId,
      type: n.type,
      severity: n.severity ?? "NORMAL",
      title: n.title,
      body: n.body,
      entityType: n.entityType ?? null,
      entityId: n.entityId ?? null,
      readAt: null,
      createdAt: now(),
    };
    db.notifications.push(notification);
  }
}

function usersWithRole(db: DemoDb, role: UserRole): string[] {
  return db.users.filter((u) => u.role === role && u.isActive).map((u) => u.id);
}

function careTeam(db: DemoDb, residentId: string): string[] {
  return db.staffAssignments
    .filter((a) => a.residentId === residentId && a.unassignedAt === null)
    .map((a) => a.userId);
}

function parentsOf(db: DemoDb, residentId: string): string[] {
  return db.residentParents
    .filter((p) => p.residentId === residentId)
    .map((p) => p.parentUserId);
}

/** The single place a resident's status changes (parent spec §4.3). */
function setResidentStatus(
  db: DemoDb,
  viewer: Viewer,
  residentId: string,
  toStatus: ResidentStatus,
  reason: string | null,
): void {
  const resident = db.residents.find((r) => r.id === residentId)!;
  db.statusHistory.push({
    id: newId("sh"),
    residentId,
    fromStatus: resident.status,
    toStatus,
    changedByUserId: viewer.id,
    reason,
    createdAt: now(),
  });
  resident.status = toStatus;
}

// ─── Residents ────────────────────────────────────────────

export const advanceResidentStatus: Mutation<{
  residentId: string;
  toStatus: ResidentStatus;
  reason: string;
  team?: { psychologistId: string; pssId: string };
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "resident.advance");
  if (denied) return denied;
  const resident = db.residents.find((r) => r.id === args.residentId);
  if (!resident) return refuse(db, "Service user not found.");
  if (
    !canTransitionResident(resident.status, args.toStatus) ||
    !manualNextStatuses(resident.status).includes(args.toStatus)
  ) {
    return refuse(db, `Cannot move from ${resident.status} to ${args.toStatus}.`);
  }
  if (args.toStatus === "MDT_ASSIGNED" && !args.team) {
    return refuse(db, "Choose a psychologist and a PSS for the care team.");
  }

  const next = structuredClone(db);
  const assign = (userId: string, role: "CSC" | "PSS" | "JR_PSYCHOLOGIST" | "MDT_HEAD") => {
    const exists = next.staffAssignments.some(
      (a) =>
        a.residentId === args.residentId &&
        a.userId === userId &&
        a.role === role &&
        a.unassignedAt === null,
    );
    if (!exists) {
      next.staffAssignments.push({
        id: newId("sa"),
        residentId: args.residentId,
        userId,
        role,
        assignedAt: now(),
        unassignedAt: null,
      });
    }
  };

  if (args.toStatus === "CSC_ASSIGNED") assign(viewer.id, "CSC");
  if (args.toStatus === "MDT_ASSIGNED" && args.team) {
    const mdt = usersWithRole(next, "MDT_HEAD")[0];
    assign(args.team.psychologistId, "JR_PSYCHOLOGIST");
    assign(args.team.pssId, "PSS");
    if (mdt) assign(mdt, "MDT_HEAD");
    notify(next, [args.team.psychologistId, args.team.pssId, ...(mdt ? [mdt] : [])], {
      type: "CARE_TEAM_ASSIGNED",
      title: "Added to care team",
      body: `You were assigned to ${residentName(next, args.residentId)}'s care team.`,
      entityType: "Resident",
      entityId: args.residentId,
    });
  }
  setResidentStatus(next, viewer, args.residentId, args.toStatus, args.reason.trim() || null);
  return { db: next };
};

// ─── Assessments ──────────────────────────────────────────

export const scheduleAssessment: Mutation<{
  residentId: string;
  assessmentTypeId: string;
  assignedToUserId: string;
  roomId: string;
  startsAt: string;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "assessment.schedule");
  if (denied) return denied;
  const resident = db.residents.find((r) => r.id === args.residentId);
  if (!resident) return refuse(db, "Service user not found.");
  if (
    !["MDT_ASSIGNED", "ASSESSMENTS_SCHEDULED", "ASSESSMENTS_IN_PROGRESS"].includes(
      resident.status,
    )
  ) {
    return refuse(db, "Assessments can be scheduled once the care team is assigned.");
  }
  const clinician = db.users.find((u) => u.id === args.assignedToUserId);
  if (clinician?.role !== "JR_PSYCHOLOGIST") return refuse(db, "Choose a psychologist.");
  const start = new Date(args.startsAt);
  if (Number.isNaN(start.getTime())) return refuse(db, "Choose a date and time.");
  const end = new Date(start.getTime() + 60 * 60000);
  const clash = db.calendarSlots.some((s) => {
    if (s.status === "CANCELLED_SLOT") return false;
    const overlaps = new Date(s.startsAt) < end && new Date(s.endsAt) > start;
    return overlaps && (s.roomId === args.roomId || s.staffUserId === args.assignedToUserId);
  });
  if (clash) return refuse(db, "That room or clinician is already booked at this time.");

  const next = structuredClone(db);
  const slotId = newId("slot");
  const type = next.assessmentTypes.find((t) => t.id === args.assessmentTypeId);
  next.calendarSlots.push({
    id: slotId,
    type: "ASSESSMENT_SLOT",
    status: "SCHEDULED_SLOT",
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    roomId: args.roomId,
    residentId: args.residentId,
    staffUserId: args.assignedToUserId,
    title: `${type?.name ?? "Assessment"}`,
    notes: null,
    createdByUserId: viewer.id,
  });
  const assessmentId = newId("a");
  next.assessments.push({
    id: assessmentId,
    residentId: args.residentId,
    assessmentTypeId: args.assessmentTypeId,
    assignedToUserId: args.assignedToUserId,
    status: "SCHEDULED",
    scheduledAt: start.toISOString(),
    calendarSlotId: slotId,
    findings: null,
    score: null,
    submittedAt: null,
    reviewedByUserId: null,
    reviewNotes: null,
    createdAt: now(),
  });
  if (resident.status === "MDT_ASSIGNED") {
    setResidentStatus(next, viewer, args.residentId, "ASSESSMENTS_SCHEDULED", "Assessments scheduled");
  }
  notify(next, [args.assignedToUserId], {
    type: "ASSESSMENT_SCHEDULED",
    title: "Assessment scheduled",
    body: `${type?.name} for ${residentName(next, args.residentId)} on ${start.toLocaleString()}.`,
    entityType: "Assessment",
    entityId: assessmentId,
  });
  return { db: next, createdId: assessmentId };
};

export const startAssessment: Mutation<{ assessmentId: string }> = (db, viewer, args) => {
  const denied = guard(db, viewer, "assessment.conduct");
  if (denied) return denied;
  const a = db.assessments.find((x) => x.id === args.assessmentId);
  if (!a || a.assignedToUserId !== viewer.id) return refuse(db, "Assessment not found.");
  if (a.status !== "SCHEDULED" && a.status !== "REVISION_REQUESTED") {
    return refuse(db, "Only a scheduled or returned assessment can be started.");
  }
  const next = structuredClone(db);
  next.assessments.find((x) => x.id === a.id)!.status = "IN_PROGRESS";
  const resident = next.residents.find((r) => r.id === a.residentId)!;
  if (resident.status === "ASSESSMENTS_SCHEDULED") {
    setResidentStatus(next, viewer, a.residentId, "ASSESSMENTS_IN_PROGRESS", "First assessment started");
  }
  return { db: next };
};

export const submitAssessment: Mutation<{
  assessmentId: string;
  items: FindingItem[];
  summary: string;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "assessment.conduct");
  if (denied) return denied;
  const a = db.assessments.find((x) => x.id === args.assessmentId);
  if (!a || a.assignedToUserId !== viewer.id) return refuse(db, "Assessment not found.");
  if (a.status !== "IN_PROGRESS") return refuse(db, "Start the assessment before submitting.");
  if (args.items.length === 0) return refuse(db, "Rate at least one item.");
  if (!args.summary.trim()) return refuse(db, "Add a summary of findings.");

  const next = structuredClone(db);
  const target = next.assessments.find((x) => x.id === a.id)!;
  target.findings = { items: args.items, summary: args.summary.trim() };
  target.score = Math.round(
    (args.items.reduce((s, i) => s + i.rating, 0) / (args.items.length * 5)) * 100,
  );
  target.status = "SUBMITTED";
  target.submittedAt = now();
  notify(next, usersWithRole(next, "MDT_HEAD"), {
    type: "ASSESSMENT_COMPLETED",
    title: "Assessment awaiting review",
    body: `An assessment for ${residentName(next, a.residentId)} was submitted.`,
    entityType: "Assessment",
    entityId: a.id,
  });
  return { db: next };
};

export const reviewAssessment: Mutation<{
  assessmentId: string;
  decision: "APPROVE" | "REVISION";
  notes: string;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "assessment.review");
  if (denied) return denied;
  const a = db.assessments.find((x) => x.id === args.assessmentId);
  if (!a) return refuse(db, "Assessment not found.");
  if (a.assignedToUserId === viewer.id) return refuse(db, "You cannot review your own assessment.");
  if (a.status !== "SUBMITTED") return refuse(db, "Only a submitted assessment can be reviewed.");
  if (args.decision === "REVISION" && !args.notes.trim()) {
    return refuse(db, "Explain what needs to change.");
  }

  const next = structuredClone(db);
  const target = next.assessments.find((x) => x.id === a.id)!;
  target.reviewedByUserId = viewer.id;
  target.reviewNotes = args.notes.trim() || null;
  if (args.decision === "REVISION") {
    target.status = "REVISION_REQUESTED";
    notify(next, [a.assignedToUserId], {
      type: "ASSESSMENT_REVISION_REQUESTED",
      title: "Revision requested",
      body: `Changes requested on an assessment for ${residentName(next, a.residentId)}.`,
      severity: "HIGH",
      entityType: "Assessment",
      entityId: a.id,
    });
    return { db: next };
  }
  target.status = "APPROVED";
  notify(next, [a.assignedToUserId], {
    type: "ASSESSMENT_APPROVED",
    title: "Assessment approved",
    body: `Your assessment for ${residentName(next, a.residentId)} was approved.`,
    entityType: "Assessment",
    entityId: a.id,
  });
  const resident = next.residents.find((r) => r.id === a.residentId)!;
  const allApproved = next.assessments
    .filter((x) => x.residentId === a.residentId)
    .every((x) => x.status === "APPROVED");
  if (allApproved && resident.status === "ASSESSMENTS_IN_PROGRESS") {
    setResidentStatus(next, viewer, a.residentId, "ASSESSMENTS_COMPLETED", "All assessments approved by MDT");
  }
  return { db: next };
};

// ─── IEP ──────────────────────────────────────────────────

export const createIepPlan: Mutation<{ residentId: string }> = (db, viewer, args) => {
  const denied = guard(db, viewer, "iep.author");
  if (denied) return denied;
  if (!canSeeResident(db, viewer, args.residentId)) return refuse(db, "Service user not found.");
  const resident = db.residents.find((r) => r.id === args.residentId)!;
  const plans = db.iepPlans.filter((p) => p.residentId === args.residentId);
  const latest = plans.sort((a, b) => b.version - a.version)[0];
  const allowed =
    resident.status === "ASSESSMENTS_COMPLETED" ||
    (resident.status === "IEP_IN_PROGRESS" && latest?.status === "REJECTED_IEP");
  if (!allowed) return refuse(db, "A plan can be created once assessments are completed.");

  const next = structuredClone(db);
  const id = newId("iep");
  next.iepPlans.push({
    id,
    residentId: args.residentId,
    version: (latest?.version ?? 0) + 1,
    status: "DRAFT_IEP",
    authoredByUserId: viewer.id,
    submittedAt: null,
    approvedByUserId: null,
    approvedAt: null,
    startDate: null,
    endDate: null,
    createdAt: now(),
  });
  if (resident.status === "ASSESSMENTS_COMPLETED") {
    setResidentStatus(next, viewer, args.residentId, "IEP_IN_PROGRESS", "IEP plan drafting started");
  }
  return { db: next, createdId: id };
};

export const addIepGoal: Mutation<{
  planId: string;
  domain: ClinicalDomain;
  title: string;
  description: string;
  frequency: GoalFrequency;
  targetCount: number;
  assignedRole: IepAssignedRole;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "iep.author");
  if (denied) return denied;
  const plan = db.iepPlans.find((p) => p.id === args.planId);
  if (!plan || plan.authoredByUserId !== viewer.id) return refuse(db, "Plan not found.");
  if (plan.status !== "DRAFT_IEP") return refuse(db, "Goals can only be added to a draft plan.");
  if (!args.title.trim()) return refuse(db, "Give the goal a title.");
  if (!(args.targetCount > 0)) return refuse(db, "Target must be at least 1.");

  const next = structuredClone(db);
  const id = newId("g");
  next.iepGoals.push({
    id,
    iepPlanId: plan.id,
    domain: args.domain,
    title: args.title.trim(),
    description: args.description.trim(),
    frequency: args.frequency,
    targetCount: args.targetCount,
    status: "NOT_STARTED",
    approvalStatus: "NOT_SUBMITTED",
    rejectionReason: null,
    assignedRole: args.assignedRole,
  });
  return { db: next, createdId: id };
};

export const submitIepPlan: Mutation<{ planId: string }> = (db, viewer, args) => {
  const denied = guard(db, viewer, "iep.author");
  if (denied) return denied;
  const plan = db.iepPlans.find((p) => p.id === args.planId);
  if (!plan || plan.authoredByUserId !== viewer.id) return refuse(db, "Plan not found.");
  if (plan.status !== "DRAFT_IEP") return refuse(db, "Only a draft plan can be submitted.");
  if (!db.iepGoals.some((g) => g.iepPlanId === plan.id)) return refuse(db, "Add at least one goal first.");

  const next = structuredClone(db);
  const target = next.iepPlans.find((p) => p.id === plan.id)!;
  target.status = "SUBMITTED_IEP";
  target.submittedAt = now();
  for (const g of next.iepGoals.filter((x) => x.iepPlanId === plan.id)) {
    g.approvalStatus = "PENDING_MDT_APPROVAL";
  }
  notify(next, usersWithRole(next, "MDT_HEAD"), {
    type: "IEP_SUBMITTED",
    title: "IEP submitted",
    body: `${residentName(next, plan.residentId)}'s IEP plan v${plan.version} is waiting for goal approval.`,
    entityType: "IepPlan",
    entityId: plan.id,
  });
  return { db: next };
};

export const reviewIepGoal: Mutation<{
  goalId: string;
  decision: "APPROVE" | "REJECT";
  reason: string;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "iep.review");
  if (denied) return denied;
  const goal = db.iepGoals.find((g) => g.id === args.goalId);
  if (!goal) return refuse(db, "Goal not found.");
  if (goal.approvalStatus !== "PENDING_MDT_APPROVAL") return refuse(db, "This goal is not waiting for review.");
  if (args.decision === "REJECT" && !args.reason.trim()) return refuse(db, "A reason is required to reject a goal.");

  const next = structuredClone(db);
  const target = next.iepGoals.find((g) => g.id === goal.id)!;
  target.approvalStatus = args.decision === "APPROVE" ? "APPROVED_MDT" : "REJECTED_MDT";
  target.rejectionReason = args.decision === "REJECT" ? args.reason.trim() : null;

  const goals = next.iepGoals.filter((g) => g.iepPlanId === goal.iepPlanId);
  const pending = goals.some((g) => g.approvalStatus === "PENDING_MDT_APPROVAL");
  if (!pending) {
    const plan = next.iepPlans.find((p) => p.id === goal.iepPlanId)!;
    if (goals.some((g) => g.approvalStatus === "APPROVED_MDT")) {
      plan.status = "APPROVED_IEP";
      plan.approvedByUserId = viewer.id;
      plan.approvedAt = now();
      const resident = next.residents.find((r) => r.id === plan.residentId)!;
      if (resident.status === "IEP_IN_PROGRESS") {
        setResidentStatus(next, viewer, plan.residentId, "IEP_APPROVED", "IEP goals approved by MDT");
      }
      notify(next, [plan.authoredByUserId, ...careTeam(next, plan.residentId).filter((id) => next.users.find((u) => u.id === id)?.role === "CSC")], {
        type: "IEP_APPROVED",
        title: "IEP approved",
        body: `${residentName(next, plan.residentId)}'s IEP plan v${plan.version} was approved.`,
        entityType: "IepPlan",
        entityId: plan.id,
      });
    } else {
      plan.status = "REJECTED_IEP";
      notify(next, [plan.authoredByUserId], {
        type: "IEP_APPROVED",
        title: "IEP returned",
        body: `Every goal in ${residentName(next, plan.residentId)}'s plan v${plan.version} was rejected. Author a new version.`,
        severity: "HIGH",
        entityType: "IepPlan",
        entityId: plan.id,
      });
    }
  }
  return { db: next };
};

export const activateIepPlan: Mutation<{ planId: string }> = (db, viewer, args) => {
  const denied = guard(db, viewer, "iep.activate");
  if (denied) return denied;
  const plan = db.iepPlans.find((p) => p.id === args.planId);
  if (!plan) return refuse(db, "Plan not found.");
  if (plan.status !== "APPROVED_IEP") return refuse(db, "Only an approved plan can be activated.");

  const next = structuredClone(db);
  const target = next.iepPlans.find((p) => p.id === plan.id)!;
  target.status = "ACTIVE_IEP";
  target.startDate = todayDate();
  const end = new Date();
  end.setDate(end.getDate() + 180);
  target.endDate = end.toISOString().slice(0, 10);
  for (const g of next.iepGoals.filter((x) => x.iepPlanId === plan.id && x.approvalStatus === "APPROVED_MDT")) {
    g.status = "IN_PROGRESS_GOAL";
  }
  const resident = next.residents.find((r) => r.id === plan.residentId)!;
  if (resident.status === "IEP_APPROVED") {
    setResidentStatus(next, viewer, plan.residentId, "ACTIVE", "Plan activated");
  }
  notify(next, [...careTeam(next, plan.residentId), ...parentsOf(next, plan.residentId)], {
    type: "IPP_FINALIZED",
    title: "Care plan active",
    body: `${residentName(next, plan.residentId)}'s care plan goals are now in place.`,
    entityType: "IepPlan",
    entityId: plan.id,
  });
  return { db: next };
};

// ─── Daily logging ────────────────────────────────────────

export const createAdlLog: Mutation<{
  adlAssignmentId: string;
  logDate: string;
  shift: Shift;
  status: AdlLogStatus;
  promptLevel: PromptLevel | null;
  mood: AdlMood | null;
  notes: string | null;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "adl.log");
  if (denied) return denied;
  const assignment = db.adlAssignments.find((a) => a.id === args.adlAssignmentId);
  if (!assignment || !canSeeResident(db, viewer, assignment.residentId)) {
    return refuse(db, "You are not assigned to this service user.");
  }
  const duplicate = db.adlLogs.some(
    (l) =>
      l.adlAssignmentId === args.adlAssignmentId &&
      l.logDate === args.logDate &&
      l.shift === args.shift,
  );
  if (duplicate) return refuse(db, "This activity is already logged for that date and shift.");

  const next = structuredClone(db);
  const id = newId("al");
  next.adlLogs.push({
    id,
    adlAssignmentId: args.adlAssignmentId,
    loggedByUserId: viewer.id,
    logDate: args.logDate,
    shift: args.shift,
    status: args.status,
    promptLevel: args.promptLevel,
    mood: args.mood,
    notes: args.notes?.trim() || null,
    approvalStatus: "SUBMITTED",
    approvedByUserId: null,
    rejectionReason: null,
    createdAt: now(),
  });
  return { db: next, createdId: id };
};

export const reviewAdlLog: Mutation<{
  logId: string;
  decision: "APPROVE" | "REJECT";
  reason: string;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "adl.review");
  if (denied) return denied;
  const log = db.adlLogs.find((l) => l.id === args.logId);
  if (!log) return refuse(db, "Log not found.");
  if (log.approvalStatus !== "SUBMITTED") return refuse(db, "This log is not waiting for approval.");
  if (args.decision === "REJECT" && !args.reason.trim()) return refuse(db, "A reason is required to reject a log.");

  const next = structuredClone(db);
  const target = next.adlLogs.find((l) => l.id === log.id)!;
  target.approvalStatus = args.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  target.approvedByUserId = viewer.id;
  target.rejectionReason = args.decision === "REJECT" ? args.reason.trim() : null;
  if (args.decision === "REJECT") {
    const assignment = next.adlAssignments.find((a) => a.id === log.adlAssignmentId);
    notify(next, [log.loggedByUserId], {
      type: "ADL_LOG_REJECTED",
      title: "ADL log returned",
      body: `A log for ${residentName(next, assignment?.residentId ?? "")} was returned: ${args.reason.trim()}`,
      entityType: "AdlLog",
      entityId: log.id,
    });
  }
  return { db: next };
};

export const logGoalProgress: Mutation<{
  goalId: string;
  logDate: string;
  outcome: IepLogOutcome;
  promptLevel: PromptLevel | null;
  notes: string | null;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "goal.log");
  if (denied) return denied;
  const goal = db.iepGoals.find((g) => g.id === args.goalId);
  const plan = db.iepPlans.find((p) => p.id === goal?.iepPlanId);
  if (!goal || !plan || !canSeeResident(db, viewer, plan.residentId)) {
    return refuse(db, "Goal not found.");
  }
  if (plan.status !== "ACTIVE_IEP" || goal.approvalStatus !== "APPROVED_MDT") {
    return refuse(db, "Progress can only be logged on approved goals of an active plan.");
  }
  const next = structuredClone(db);
  const id = newId("gp");
  next.goalProgressLogs.push({
    id,
    iepGoalId: goal.id,
    loggedByUserId: viewer.id,
    logDate: args.logDate,
    outcome: args.outcome,
    promptLevel: args.promptLevel,
    notes: args.notes?.trim() || null,
    createdAt: now(),
  });
  return { db: next, createdId: id };
};

// ─── Incidents ────────────────────────────────────────────

export const reportIncident: Mutation<{
  residentId: string;
  type: IncidentType;
  severity: NotificationSeverity;
  occurredAt: string;
  location: string | null;
  description: string;
  notifyParent: boolean;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "incident.report");
  if (denied) return denied;
  if (!canSeeResident(db, viewer, args.residentId)) {
    return refuse(db, "You are not assigned to this service user.");
  }
  if (!args.description.trim()) return refuse(db, "Describe what happened.");
  if (new Date(args.occurredAt).getTime() > Date.now() + 5 * 60000) {
    return refuse(db, "An incident cannot be in the future.");
  }

  const next = structuredClone(db);
  const id = newId("i");
  next.incidents.push({
    id,
    residentId: args.residentId,
    reportedByUserId: viewer.id,
    type: args.type,
    status: "REPORTED",
    severity: args.severity,
    occurredAt: new Date(args.occurredAt).toISOString(),
    location: args.location?.trim() || null,
    description: args.description.trim(),
    notifyParent: args.notifyParent,
    reviewedByUserId: null,
    resolution: null,
    resolvedAt: null,
    createdAt: now(),
  });
  const recipients = careTeam(next, args.residentId).filter((uid) => uid !== viewer.id);
  notify(next, recipients, {
    type: "INCIDENT_REPORTED",
    title: "New incident reported",
    body: `An incident was reported for ${residentName(next, args.residentId)}.`,
    severity: args.severity,
    entityType: "Incident",
    entityId: id,
  });
  if (args.notifyParent) {
    notify(next, parentsOf(next, args.residentId), {
      type: "INCIDENT_REPORTED",
      title: "Incident update",
      body: `Staff recorded an incident involving ${residentName(next, args.residentId)}. The care team is following up.`,
      entityType: "Incident",
      entityId: id,
    });
  }
  return { db: next, createdId: id };
};

export const reviewIncident: Mutation<{
  incidentId: string;
  action: "START_REVIEW" | "ESCALATE" | "RESOLVE";
  resolution?: string;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "incident.review");
  if (denied) return denied;
  const incident = db.incidents.find((i) => i.id === args.incidentId);
  if (!incident) return refuse(db, "Incident not found.");

  const allowed: Record<typeof args.action, string[]> = {
    START_REVIEW: ["REPORTED"],
    ESCALATE: ["UNDER_REVIEW"],
    RESOLVE: ["UNDER_REVIEW", "ESCALATED"],
  };
  if (!allowed[args.action].includes(incident.status)) {
    return refuse(db, `Cannot ${args.action.toLowerCase().replace("_", " ")} an incident that is ${incident.status}.`);
  }
  if (args.action === "RESOLVE" && !args.resolution?.trim()) {
    return refuse(db, "Describe how the incident was resolved.");
  }

  const next = structuredClone(db);
  const target = next.incidents.find((i) => i.id === incident.id)!;
  target.reviewedByUserId = viewer.id;
  if (args.action === "START_REVIEW") target.status = "UNDER_REVIEW";
  if (args.action === "ESCALATE") {
    target.status = "ESCALATED";
    target.severity = "CRITICAL_INTERRUPT";
    notify(next, usersWithRole(next, "SUPER_ADMIN"), {
      type: "INCIDENT_ESCALATED",
      title: "Incident escalated",
      body: `An incident for ${residentName(next, incident.residentId)} was escalated.`,
      severity: "CRITICAL_INTERRUPT",
      entityType: "Incident",
      entityId: incident.id,
    });
  }
  if (args.action === "RESOLVE") {
    target.status = "RESOLVED";
    target.resolution = args.resolution!.trim();
    target.resolvedAt = now();
    notify(next, [incident.reportedByUserId, ...(incident.notifyParent ? parentsOf(next, incident.residentId) : [])], {
      type: "INCIDENT_RESOLVED",
      title: "Incident resolved",
      body: `The incident for ${residentName(next, incident.residentId)} has been reviewed and resolved.`,
      entityType: "Incident",
      entityId: incident.id,
    });
  }
  return { db: next };
};

export const closeIncident: Mutation<{ incidentId: string }> = (db, viewer, args) => {
  const denied = guard(db, viewer, "incident.close");
  if (denied) return denied;
  const incident = db.incidents.find((i) => i.id === args.incidentId);
  if (!incident) return refuse(db, "Incident not found.");
  if (incident.status !== "RESOLVED") return refuse(db, "Only a resolved incident can be closed.");
  const next = structuredClone(db);
  next.incidents.find((i) => i.id === incident.id)!.status = "CLOSED";
  return { db: next };
};

// ─── Notifications ────────────────────────────────────────

export const markNotificationRead: Mutation<{ notificationId: string }> = (db, viewer, args) => {
  const n = db.notifications.find((x) => x.id === args.notificationId);
  if (!n || n.userId !== viewer.id) return refuse(db, "Notification not found.");
  if (n.readAt) return { db };
  const next = structuredClone(db);
  next.notifications.find((x) => x.id === n.id)!.readAt = now();
  return { db: next };
};

export const markAllNotificationsRead: Mutation<Record<string, never>> = (db, viewer) => {
  const next = structuredClone(db);
  const stamp = now();
  for (const n of next.notifications) {
    if (n.userId === viewer.id && !n.readAt) n.readAt = stamp;
  }
  return { db: next };
};

// ─── Users ────────────────────────────────────────────────

export const createUser: Mutation<{
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  clinicalDomain: ClinicalDomain | null;
}> = (db, viewer, args) => {
  const denied = guard(db, viewer, "user.manage");
  if (denied) return denied;
  const email = args.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return refuse(db, "Enter a valid email address.");
  if (db.users.some((u) => u.email === email)) return refuse(db, "A user with this email already exists.");
  if (!args.firstName.trim() || !args.lastName.trim()) return refuse(db, "First and last name are required.");
  const next = structuredClone(db);
  const id = newId("u");
  next.users.push({
    id,
    email,
    firstName: args.firstName.trim(),
    lastName: args.lastName.trim(),
    role: args.role,
    clinicalDomain: ["JR_PSYCHOLOGIST", "MDT_HEAD"].includes(args.role) ? args.clinicalDomain : null,
    isActive: true,
    createdAt: now(),
  });
  return { db: next, createdId: id };
};

export const setUserActive: Mutation<{ userId: string; isActive: boolean }> = (db, viewer, args) => {
  const denied = guard(db, viewer, "user.manage");
  if (denied) return denied;
  if (args.userId === viewer.id) return refuse(db, "You cannot deactivate your own account.");
  if (!db.users.some((u) => u.id === args.userId)) return refuse(db, "User not found.");
  const next = structuredClone(db);
  next.users.find((u) => u.id === args.userId)!.isActive = args.isActive;
  return { db: next };
};
