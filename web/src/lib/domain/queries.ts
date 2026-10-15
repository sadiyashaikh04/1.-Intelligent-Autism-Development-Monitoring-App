import type {
  AdlActivity,
  AdlApprovalStatus,
  AdlAssignment,
  AdlLog,
  Assessment,
  AssessmentType,
  CalendarSlot,
  ClinicalDomain,
  DemoDb,
  DevelopmentSnapshot,
  GoalProgressLog,
  IepGoal,
  IepPlan,
  Incident,
  Notification,
  Resident,
  ResidentParent,
  ResidentStatus,
  RiskAssessment,
  Room,
  StaffAssignment,
  StatusHistoryEntry,
  User,
  UserRole,
  Viewer,
} from "@/data/types";
import { can } from "@/lib/domain/permissions";

/**
 * Pure reads over the demo database. Every function takes the viewer and
 * applies resident scoping (parent spec §3.1): PSS and JR_PSYCHOLOGIST see
 * residents they are actively assigned to, PARENT sees their linked child,
 * everyone else sees all.
 */

const STAFF_SEE_ALL: UserRole[] = ["SUPER_ADMIN", "CSC", "MDT_HEAD"];

export function visibleResidentIds(db: DemoDb, viewer: Viewer): Set<string> {
  if (STAFF_SEE_ALL.includes(viewer.role)) {
    return new Set(db.residents.map((r) => r.id));
  }
  if (viewer.role === "PARENT") {
    return new Set(
      db.residentParents
        .filter((link) => link.parentUserId === viewer.id)
        .map((link) => link.residentId),
    );
  }
  return new Set(
    db.staffAssignments
      .filter((a) => a.userId === viewer.id && a.unassignedAt === null)
      .map((a) => a.residentId),
  );
}

export function userById(db: DemoDb, id: string | null): User | undefined {
  return id ? db.users.find((u) => u.id === id) : undefined;
}

export function residentById(db: DemoDb, id: string): Resident | undefined {
  return db.residents.find((r) => r.id === id);
}

export function listResidents(
  db: DemoDb,
  viewer: Viewer,
  filter: { q?: string; status?: ResidentStatus | "" },
): Resident[] {
  const visible = visibleResidentIds(db, viewer);
  const q = filter.q?.trim().toLowerCase();
  return db.residents
    .filter((r) => visible.has(r.id))
    .filter((r) => !filter.status || r.status === filter.status)
    .filter(
      (r) =>
        !q ||
        r.code.toLowerCase().includes(q) ||
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q),
    )
    .sort((a, b) => a.code.localeCompare(b.code));
}

export interface HistoryRow {
  entry: StatusHistoryEntry;
  changedBy: User | undefined;
}
export interface CareTeamRow {
  assignment: StaffAssignment;
  user: User | undefined;
}
export interface ParentRow {
  link: ResidentParent;
  parent: User | undefined;
}
export interface AssessmentRow {
  assessment: Assessment;
  type: AssessmentType | undefined;
  resident: Resident | undefined;
  assignee: User | undefined;
}
export interface GoalRow {
  goal: IepGoal;
  progress: GoalProgressLog[];
}
export interface PlanRow {
  plan: IepPlan;
  resident: Resident | undefined;
  author: User | undefined;
  goals: GoalRow[];
}
export interface AdlLogRow {
  log: AdlLog;
  assignment: AdlAssignment | undefined;
  activity: AdlActivity | undefined;
  resident: Resident | undefined;
  loggedBy: User | undefined;
}

export interface ResidentDetail {
  resident: Resident;
  statusHistory: HistoryRow[];
  careTeam: CareTeamRow[];
  parents: ParentRow[];
  assessments: AssessmentRow[];
  plans: PlanRow[];
  recentAdl: AdlLogRow[];
}

export function getResidentDetail(
  db: DemoDb,
  viewer: Viewer,
  id: string,
): ResidentDetail | null {
  const resident = residentById(db, id);
  if (!resident || !visibleResidentIds(db, viewer).has(id)) return null;

  return {
    resident,
    statusHistory: db.statusHistory
      .filter((h) => h.residentId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => ({ entry, changedBy: userById(db, entry.changedByUserId) })),
    careTeam: db.staffAssignments
      .filter((a) => a.residentId === id && a.unassignedAt === null)
      .map((assignment) => ({ assignment, user: userById(db, assignment.userId) })),
    parents: db.residentParents
      .filter((p) => p.residentId === id)
      .map((link) => ({ link, parent: userById(db, link.parentUserId) })),
    assessments: db.assessments
      .filter((a) => a.residentId === id)
      .map((a) => assessmentRow(db, a)),
    plans: db.iepPlans
      .filter((p) => p.residentId === id)
      .sort((a, b) => b.version - a.version)
      .map((p) => planRow(db, p)),
    recentAdl: adlRows(
      db,
      db.adlLogs.filter((log) => {
        const assignment = db.adlAssignments.find(
          (a) => a.id === log.adlAssignmentId,
        );
        return assignment?.residentId === id;
      }),
    ).slice(0, 30),
  };
}

function assessmentRow(db: DemoDb, assessment: Assessment): AssessmentRow {
  return {
    assessment,
    type: db.assessmentTypes.find((t) => t.id === assessment.assessmentTypeId),
    resident: residentById(db, assessment.residentId),
    assignee: userById(db, assessment.assignedToUserId),
  };
}

function planRow(db: DemoDb, plan: IepPlan): PlanRow {
  return {
    plan,
    resident: residentById(db, plan.residentId),
    author: userById(db, plan.authoredByUserId),
    goals: db.iepGoals
      .filter((g) => g.iepPlanId === plan.id)
      .map((goal) => ({
        goal,
        progress: db.goalProgressLogs
          .filter((l) => l.iepGoalId === goal.id)
          .sort((a, b) => b.logDate.localeCompare(a.logDate)),
      })),
  };
}

function adlRows(db: DemoDb, logs: AdlLog[]): AdlLogRow[] {
  return logs
    .map((log) => {
      const assignment = db.adlAssignments.find(
        (a) => a.id === log.adlAssignmentId,
      );
      return {
        log,
        assignment,
        activity: db.adlActivities.find((x) => x.id === assignment?.adlActivityId),
        resident: assignment ? residentById(db, assignment.residentId) : undefined,
        loggedBy: userById(db, log.loggedByUserId),
      };
    })
    .sort(
      (a, b) =>
        b.log.logDate.localeCompare(a.log.logDate) ||
        b.log.createdAt.localeCompare(a.log.createdAt),
    );
}

export function listAssessments(db: DemoDb, viewer: Viewer): AssessmentRow[] {
  const visible = visibleResidentIds(db, viewer);
  return db.assessments
    .filter((a) => visible.has(a.residentId))
    .filter(
      (a) => viewer.role !== "JR_PSYCHOLOGIST" || a.assignedToUserId === viewer.id,
    )
    .map((a) => assessmentRow(db, a))
    .sort((a, b) =>
      (b.assessment.scheduledAt ?? "").localeCompare(a.assessment.scheduledAt ?? ""),
    );
}

export function getAssessment(
  db: DemoDb,
  viewer: Viewer,
  id: string,
): AssessmentRow | null {
  return listAssessments(db, viewer).find((row) => row.assessment.id === id) ?? null;
}

export function listIepPlans(db: DemoDb, viewer: Viewer): PlanRow[] {
  const visible = visibleResidentIds(db, viewer);
  return db.iepPlans
    .filter((p) => visible.has(p.residentId))
    .map((p) => planRow(db, p))
    .sort((a, b) => b.plan.createdAt.localeCompare(a.plan.createdAt));
}

export function getIepPlan(db: DemoDb, viewer: Viewer, id: string): PlanRow | null {
  return listIepPlans(db, viewer).find((row) => row.plan.id === id) ?? null;
}

export interface PssAssignmentRow {
  assignment: AdlAssignment;
  activity: AdlActivity | undefined;
  resident: Resident | undefined;
}

export function listAdlAssignments(
  db: DemoDb,
  viewer: Viewer,
  residentId?: string,
): PssAssignmentRow[] {
  const visible = visibleResidentIds(db, viewer);
  return db.adlAssignments
    .filter((a) => a.isActive && visible.has(a.residentId))
    .filter((a) => !residentId || a.residentId === residentId)
    .map((assignment) => ({
      assignment,
      activity: db.adlActivities.find((x) => x.id === assignment.adlActivityId),
      resident: residentById(db, assignment.residentId),
    }));
}

export function listAdlLogs(
  db: DemoDb,
  viewer: Viewer,
  filter: {
    residentId?: string;
    approvalStatus?: AdlApprovalStatus;
    logDate?: string;
  },
): AdlLogRow[] {
  const assignmentIds = new Set(
    listAdlAssignments(db, viewer, filter.residentId).map((r) => r.assignment.id),
  );
  return adlRows(
    db,
    db.adlLogs.filter(
      (log) =>
        assignmentIds.has(log.adlAssignmentId) &&
        (!filter.approvalStatus || log.approvalStatus === filter.approvalStatus) &&
        (!filter.logDate || log.logDate === filter.logDate),
    ),
  );
}

export interface IncidentRow {
  incident: Incident;
  resident: Resident | undefined;
  reportedBy: User | undefined;
  reviewedBy: User | undefined;
}

export function listIncidents(db: DemoDb, viewer: Viewer): IncidentRow[] {
  const visible = visibleResidentIds(db, viewer);
  return db.incidents
    .filter(
      (i) =>
        visible.has(i.residentId) || i.reportedByUserId === viewer.id,
    )
    .filter((i) => viewer.role !== "PARENT" || i.notifyParent)
    .map((incident) => ({
      incident,
      resident: residentById(db, incident.residentId),
      reportedBy: userById(db, incident.reportedByUserId),
      reviewedBy: userById(db, incident.reviewedByUserId),
    }))
    .sort((a, b) => b.incident.occurredAt.localeCompare(a.incident.occurredAt));
}

export function getIncident(
  db: DemoDb,
  viewer: Viewer,
  id: string,
): IncidentRow | null {
  return listIncidents(db, viewer).find((r) => r.incident.id === id) ?? null;
}

export interface SlotRow {
  slot: CalendarSlot;
  resident: Resident | undefined;
  room: Room | undefined;
  staff: User | undefined;
}

export function listCalendarSlots(
  db: DemoDb,
  viewer: Viewer,
  weekStart: Date,
): SlotRow[] {
  const from = weekStart.getTime();
  const to = from + 7 * 24 * 3600 * 1000;
  const seeAll = ["SUPER_ADMIN", "CSC", "MDT_HEAD"].includes(viewer.role);
  const children = visibleResidentIds(db, viewer);
  return db.calendarSlots
    .filter((s) => {
      const t = new Date(s.startsAt).getTime();
      return t >= from && t < to;
    })
    .filter((s) =>
      seeAll
        ? true
        : viewer.role === "PARENT"
          ? s.residentId !== null && children.has(s.residentId)
          : s.staffUserId === viewer.id,
    )
    .map((slot) => ({
      slot,
      resident: slot.residentId ? residentById(db, slot.residentId) : undefined,
      room: db.rooms.find((r) => r.id === slot.roomId),
      staff: userById(db, slot.staffUserId),
    }))
    .sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt));
}

export function listNotifications(db: DemoDb, viewer: Viewer): Notification[] {
  return db.notifications
    .filter((n) => n.userId === viewer.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unreadCount(db: DemoDb, viewer: Viewer): number {
  return db.notifications.filter((n) => n.userId === viewer.id && !n.readAt)
    .length;
}

export interface DomainTrend {
  domain: ClinicalDomain;
  points: DevelopmentSnapshot[];
  latest: DevelopmentSnapshot;
}

export function getDevelopment(
  db: DemoDb,
  viewer: Viewer,
  residentId: string,
): DomainTrend[] | null {
  if (!visibleResidentIds(db, viewer).has(residentId)) return null;
  const byDomain = new Map<ClinicalDomain, DevelopmentSnapshot[]>();
  for (const s of db.developmentSnapshots.filter((x) => x.residentId === residentId)) {
    byDomain.set(s.domain, [...(byDomain.get(s.domain) ?? []), s]);
  }
  return [...byDomain.entries()].map(([domain, points]) => {
    const sorted = points.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    return { domain, points: sorted, latest: sorted[sorted.length - 1]! };
  });
}

export interface DeclineFlag {
  resident: Resident;
  snapshot: DevelopmentSnapshot;
}

/** Latest per resident/domain where the trajectory declined or fell 2 SD below baseline. */
export function listDeclineFlags(db: DemoDb, viewer: Viewer): DeclineFlag[] {
  if (viewer.role === "PARENT") return [];
  const flags: DeclineFlag[] = [];
  for (const residentId of visibleResidentIds(db, viewer)) {
    const resident = residentById(db, residentId)!;
    for (const trend of getDevelopment(db, viewer, residentId) ?? []) {
      const s = trend.latest;
      if (s.trajectory === "DECLINING" || (s.baselineDeviation ?? 0) <= -2) {
        flags.push({ resident, snapshot: s });
      }
    }
  }
  return flags.sort(
    (a, b) => (a.snapshot.baselineDeviation ?? 0) - (b.snapshot.baselineDeviation ?? 0),
  );
}

export interface RiskRow {
  resident: Resident;
  risk: RiskAssessment;
}

/** Risk bands are clinical triage output — never shown to PSS or PARENT. */
export function listRiskBoard(db: DemoDb, viewer: Viewer): RiskRow[] {
  if (!can(viewer.role, "insights.risk")) return [];
  const visible = visibleResidentIds(db, viewer);
  const latest = new Map<string, RiskAssessment>();
  for (const r of db.riskAssessments) {
    if (!visible.has(r.residentId)) continue;
    const current = latest.get(r.residentId);
    if (!current || r.computedAt > current.computedAt) latest.set(r.residentId, r);
  }
  return [...latest.values()]
    .map((risk) => ({ resident: residentById(db, risk.residentId)!, risk }))
    .sort((a, b) => b.risk.score - a.risk.score);
}

const ROLE_ORDER: UserRole[] = ["SUPER_ADMIN", "CSC", "JR_PSYCHOLOGIST", "MDT_HEAD", "PSS", "PARENT"];

export function listUsers(db: DemoDb): User[] {
  return [...db.users].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.email.localeCompare(b.email),
  );
}
