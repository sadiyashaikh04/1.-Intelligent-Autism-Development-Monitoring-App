/**
 * Record types for the demo data layer. Field names and enum values mirror
 * backend/prisma/schema.prisma exactly, so when pages are rewired to the
 * real API the shapes already line up.
 *
 * ALL SAMPLE DATA IS SYNTHETIC. No real clinical records, ever.
 */

export type UserRole =
  | "SUPER_ADMIN"
  | "CSC"
  | "JR_PSYCHOLOGIST"
  | "MDT_HEAD"
  | "PSS"
  | "PARENT";
export type ClinicalDomain =
  | "PSYCHOLOGY"
  | "OCCUPATIONAL_THERAPY"
  | "SPEECH_THERAPY"
  | "SPECIAL_EDUCATION";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type ProgramType = "COMMUNITY" | "FAMILY_LIVING";
export type ResidentStatus =
  | "IMPORTED"
  | "ENROLLED"
  | "CSC_ASSIGNED"
  | "MDT_ASSIGNED"
  | "ASSESSMENTS_SCHEDULED"
  | "ASSESSMENTS_IN_PROGRESS"
  | "ASSESSMENTS_COMPLETED"
  | "IEP_IN_PROGRESS"
  | "IEP_APPROVED"
  | "ACTIVE"
  | "INACTIVE";
export type StaffAssignmentRole = "CSC" | "PSS" | "JR_PSYCHOLOGIST" | "MDT_HEAD";
export type AssessmentStatus =
  | "PENDING"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "APPROVED"
  | "REVISION_REQUESTED";
export type IepStatus =
  | "DRAFT_IEP"
  | "SUBMITTED_IEP"
  | "APPROVED_IEP"
  | "ACTIVE_IEP"
  | "COMPLETED_IEP"
  | "REJECTED_IEP";
export type IepGoalApprovalStatus =
  | "NOT_SUBMITTED"
  | "PENDING_MDT_APPROVAL"
  | "APPROVED_MDT"
  | "REJECTED_MDT";
export type IepAssignedRole = "PSS" | "CLINICIAN";
export type GoalFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type GoalStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS_GOAL"
  | "ACHIEVED"
  | "PARTIALLY_ACHIEVED"
  | "DISCONTINUED_GOAL";
export type IepLogOutcome =
  | "ACHIEVED_LOG"
  | "PARTIALLY_ACHIEVED_LOG"
  | "NOT_ACHIEVED_LOG";
export type PromptLevel =
  | "INDEPENDENT"
  | "VERBAL"
  | "GESTURAL"
  | "PARTIAL_PHYSICAL"
  | "FULL_PHYSICAL";
export type Shift = "MORNING" | "EVENING" | "NIGHT";
export type AdlCategory = "ADL" | "IADL";
export type AdlLogStatus = "TODO" | "IN_PROGRESS_ADL" | "DONE";
export type AdlApprovalStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type AdlMood = "CALM" | "ANXIOUS" | "ESCALATED" | "MELTDOWN";
export type RoomType =
  | "THERAPY"
  | "ASSESSMENT_ROOM"
  | "CONSULTATION"
  | "CLASSROOM"
  | "GENERAL";
export type SlotType =
  | "ASSESSMENT_SLOT"
  | "THERAPY_SESSION"
  | "IPP_ACTIVITY"
  | "IPP_MEETING_SLOT"
  | "GENERAL_SLOT";
export type SlotStatus =
  | "SCHEDULED_SLOT"
  | "CONFIRMED"
  | "IN_PROGRESS_SLOT"
  | "COMPLETED_SLOT"
  | "CANCELLED_SLOT";
export type IncidentType =
  | "INJURY"
  | "AGGRESSION"
  | "MELTDOWN"
  | "SELF_HARM"
  | "FALL"
  | "ELOPEMENT"
  | "OTHER_INCIDENT";
export type IncidentStatus =
  | "REPORTED"
  | "UNDER_REVIEW"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED";
export type TrajectoryDirection =
  | "IMPROVING"
  | "STABLE"
  | "DECLINING"
  | "INSUFFICIENT_DATA";
export type RiskBand = "LOW" | "MEDIUM" | "HIGH";
export type NotificationType =
  | "CARE_TEAM_ASSIGNED"
  | "ASSESSMENT_SCHEDULED"
  | "ASSESSMENT_COMPLETED"
  | "ASSESSMENT_APPROVED"
  | "ASSESSMENT_REVISION_REQUESTED"
  | "IEP_SUBMITTED"
  | "IEP_APPROVED"
  | "IPP_FINALIZED"
  | "ADL_LOG_REJECTED"
  | "INCIDENT_REPORTED"
  | "INCIDENT_ESCALATED"
  | "INCIDENT_RESOLVED"
  | "SESSION_REMINDER"
  | "PERFORMANCE_DECLINE_DETECTED"
  | "ELEVATED_RISK_FLAGGED";
export type NotificationSeverity = "NORMAL" | "HIGH" | "CRITICAL_INTERRUPT";

/** ISO-8601 timestamp, e.g. "2026-10-15T09:30:00.000Z". */
export type Iso = string;
/** Calendar date, "YYYY-MM-DD". */
export type IsoDate = string;

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  clinicalDomain: ClinicalDomain | null;
  isActive: boolean;
  createdAt: Iso;
}

export interface Resident {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  dateOfBirth: IsoDate;
  gender: Gender;
  programType: ProgramType;
  status: ResidentStatus;
  admissionDate: IsoDate | null;
  createdAt: Iso;
}

export interface StatusHistoryEntry {
  id: string;
  residentId: string;
  fromStatus: ResidentStatus | null;
  toStatus: ResidentStatus;
  changedByUserId: string;
  reason: string | null;
  createdAt: Iso;
}

export interface StaffAssignment {
  id: string;
  residentId: string;
  userId: string;
  role: StaffAssignmentRole;
  assignedAt: Iso;
  unassignedAt: Iso | null;
}

export interface ResidentParent {
  id: string;
  residentId: string;
  parentUserId: string;
  relationship: string;
}

export interface AssessmentType {
  id: string;
  name: string;
  code: string;
  domain: ClinicalDomain;
  description: string;
  isActive: boolean;
}

/** One rated item in an assessment's structured findings. */
export interface FindingItem {
  item: string;
  rating: number; // 1 (significant support needed) … 5 (independent)
}

export interface Assessment {
  id: string;
  residentId: string;
  assessmentTypeId: string;
  assignedToUserId: string;
  status: AssessmentStatus;
  scheduledAt: Iso | null;
  calendarSlotId: string | null;
  findings: { items: FindingItem[]; summary: string } | null;
  score: number | null;
  submittedAt: Iso | null;
  reviewedByUserId: string | null;
  reviewNotes: string | null;
  createdAt: Iso;
}

export interface IepPlan {
  id: string;
  residentId: string;
  version: number;
  status: IepStatus;
  authoredByUserId: string;
  submittedAt: Iso | null;
  approvedByUserId: string | null;
  approvedAt: Iso | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  createdAt: Iso;
}

export interface IepGoal {
  id: string;
  iepPlanId: string;
  domain: ClinicalDomain;
  title: string;
  description: string;
  frequency: GoalFrequency;
  targetCount: number;
  status: GoalStatus;
  approvalStatus: IepGoalApprovalStatus;
  rejectionReason: string | null;
  assignedRole: IepAssignedRole;
}

export interface GoalProgressLog {
  id: string;
  iepGoalId: string;
  loggedByUserId: string;
  logDate: IsoDate;
  outcome: IepLogOutcome;
  promptLevel: PromptLevel | null;
  notes: string | null;
  createdAt: Iso;
}

export interface AdlActivity {
  id: string;
  name: string;
  code: string;
  category: AdlCategory;
  description: string;
  isActive: boolean;
}

export interface AdlAssignment {
  id: string;
  residentId: string;
  adlActivityId: string;
  assignedByUserId: string;
  frequency: GoalFrequency;
  isActive: boolean;
}

export interface AdlLog {
  id: string;
  adlAssignmentId: string;
  loggedByUserId: string;
  logDate: IsoDate;
  shift: Shift;
  status: AdlLogStatus;
  promptLevel: PromptLevel | null;
  mood: AdlMood | null;
  notes: string | null;
  approvalStatus: AdlApprovalStatus;
  approvedByUserId: string | null;
  rejectionReason: string | null;
  createdAt: Iso;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  isActive: boolean;
}

export interface CalendarSlot {
  id: string;
  type: SlotType;
  status: SlotStatus;
  startsAt: Iso;
  endsAt: Iso;
  roomId: string | null;
  residentId: string | null;
  staffUserId: string;
  title: string;
  notes: string | null;
  createdByUserId: string;
}

export interface Incident {
  id: string;
  residentId: string;
  reportedByUserId: string;
  type: IncidentType;
  status: IncidentStatus;
  severity: NotificationSeverity;
  occurredAt: Iso;
  location: string | null;
  description: string;
  notifyParent: boolean;
  reviewedByUserId: string | null;
  resolution: string | null;
  resolvedAt: Iso | null;
  createdAt: Iso;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: Iso | null;
  createdAt: Iso;
}

export interface DevelopmentSnapshot {
  id: string;
  residentId: string;
  domain: ClinicalDomain;
  weekStart: IsoDate;
  independenceIndex: number;
  goalAchievementRate: number;
  adlCompletionRate: number;
  trajectory: TrajectoryDirection;
  slope: number;
  baselineDeviation: number | null;
  computedAt: Iso;
}

export interface RiskFactor {
  feature: string;
  contribution: number;
  direction: "UP" | "DOWN";
  /** Plain-language explanation the clinician reads. */
  explanation: string;
}

export interface RiskAssessment {
  id: string;
  residentId: string;
  assessedFor: IsoDate;
  band: RiskBand;
  score: number;
  topFactors: RiskFactor[];
  modelVersion: string;
  computedAt: Iso;
}

export interface DemoDb {
  users: User[];
  residents: Resident[];
  statusHistory: StatusHistoryEntry[];
  staffAssignments: StaffAssignment[];
  residentParents: ResidentParent[];
  assessmentTypes: AssessmentType[];
  assessments: Assessment[];
  iepPlans: IepPlan[];
  iepGoals: IepGoal[];
  goalProgressLogs: GoalProgressLog[];
  adlActivities: AdlActivity[];
  adlAssignments: AdlAssignment[];
  adlLogs: AdlLog[];
  rooms: Room[];
  calendarSlots: CalendarSlot[];
  incidents: Incident[];
  notifications: Notification[];
  developmentSnapshots: DevelopmentSnapshot[];
  riskAssessments: RiskAssessment[];
}

/** The signed-in demo user, as every query and mutation sees them. */
export type Viewer = Pick<
  User,
  "id" | "role" | "firstName" | "lastName" | "email"
>;
