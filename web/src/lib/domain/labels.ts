import type {
  AdlApprovalStatus,
  AssessmentStatus,
  ClinicalDomain,
  GoalStatus,
  IepGoalApprovalStatus,
  IepStatus,
  IncidentStatus,
  NotificationSeverity,
  ResidentStatus,
  RiskBand,
  TrajectoryDirection,
  UserRole,
} from "@/data/types";

/** Colour families a chip can use; mapped to classes in config/theme.ts. */
export type Tone = "neutral" | "info" | "brand" | "success" | "warning" | "danger";

/** "IN_PROGRESS_GOAL" → "In progress": drop the disambiguating suffix, sentence-case. */
export function humanize(value: string): string {
  const cleaned = value
    .replace(/_(GOAL|LOG|ADL|SLOT|IEP|MDT|INCIDENT|ROOM)$/, "")
    .replace(/_/g, " ")
    .toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  CSC: "Clinical Services Coordinator",
  JR_PSYCHOLOGIST: "Junior Psychologist",
  MDT_HEAD: "MDT Head",
  PSS: "Personal Support Staff",
  PARENT: "Parent",
};

export const ROLE_SHORT: Record<UserRole, string> = {
  SUPER_ADMIN: "Admin",
  CSC: "CSC",
  JR_PSYCHOLOGIST: "Psychologist",
  MDT_HEAD: "MDT Head",
  PSS: "PSS",
  PARENT: "Parent",
};

export const DOMAIN_LABELS: Record<ClinicalDomain, string> = {
  PSYCHOLOGY: "Psychology",
  OCCUPATIONAL_THERAPY: "Occupational therapy",
  SPEECH_THERAPY: "Speech therapy",
  SPECIAL_EDUCATION: "Special education",
};

export const RESIDENT_STATUS_LABELS: Record<ResidentStatus, string> = {
  IMPORTED: "Imported",
  ENROLLED: "Enrolled",
  CSC_ASSIGNED: "CSC assigned",
  MDT_ASSIGNED: "Care team assigned",
  ASSESSMENTS_SCHEDULED: "Assessments scheduled",
  ASSESSMENTS_IN_PROGRESS: "Assessments in progress",
  ASSESSMENTS_COMPLETED: "Assessments completed",
  IEP_IN_PROGRESS: "IEP in progress",
  IEP_APPROVED: "IEP approved",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export function residentStatusTone(status: ResidentStatus): Tone {
  if (status === "ACTIVE") return "success";
  if (status === "INACTIVE") return "danger";
  if (status === "IMPORTED" || status === "ENROLLED") return "neutral";
  if (status.startsWith("ASSESSMENTS")) return "info";
  if (status.startsWith("IEP")) return "brand";
  return "warning";
}

export function assessmentTone(status: AssessmentStatus): Tone {
  return (
    {
      PENDING: "neutral",
      SCHEDULED: "info",
      IN_PROGRESS: "brand",
      SUBMITTED: "warning",
      APPROVED: "success",
      REVISION_REQUESTED: "danger",
    } as const
  )[status];
}

export function iepTone(status: IepStatus): Tone {
  return (
    {
      DRAFT_IEP: "neutral",
      SUBMITTED_IEP: "warning",
      APPROVED_IEP: "info",
      ACTIVE_IEP: "success",
      COMPLETED_IEP: "brand",
      REJECTED_IEP: "danger",
    } as const
  )[status];
}

export function goalApprovalTone(status: IepGoalApprovalStatus): Tone {
  return (
    {
      NOT_SUBMITTED: "neutral",
      PENDING_MDT_APPROVAL: "warning",
      APPROVED_MDT: "success",
      REJECTED_MDT: "danger",
    } as const
  )[status];
}

export function goalStatusTone(status: GoalStatus): Tone {
  return (
    {
      NOT_STARTED: "neutral",
      IN_PROGRESS_GOAL: "brand",
      ACHIEVED: "success",
      PARTIALLY_ACHIEVED: "info",
      DISCONTINUED_GOAL: "danger",
    } as const
  )[status];
}

export function adlApprovalTone(status: AdlApprovalStatus): Tone {
  return (
    { DRAFT: "neutral", SUBMITTED: "warning", APPROVED: "success", REJECTED: "danger" } as const
  )[status];
}

export function incidentTone(status: IncidentStatus): Tone {
  return (
    {
      REPORTED: "warning",
      UNDER_REVIEW: "info",
      ESCALATED: "danger",
      RESOLVED: "success",
      CLOSED: "neutral",
    } as const
  )[status];
}

export function severityTone(severity: NotificationSeverity): Tone {
  return ({ NORMAL: "neutral", HIGH: "warning", CRITICAL_INTERRUPT: "danger" } as const)[severity];
}

export function riskTone(band: RiskBand): Tone {
  return ({ LOW: "success", MEDIUM: "warning", HIGH: "danger" } as const)[band];
}

export function trajectoryTone(direction: TrajectoryDirection): Tone {
  return (
    { IMPROVING: "success", STABLE: "info", DECLINING: "danger", INSUFFICIENT_DATA: "neutral" } as const
  )[direction];
}

/** Plain-language trajectory for parents (parent spec §2.4) — never a score. */
export function trajectorySentence(
  direction: TrajectoryDirection,
  domain: ClinicalDomain,
): string {
  const area = DOMAIN_LABELS[domain].toLowerCase();
  switch (direction) {
    case "IMPROVING":
      return `Steady progress in ${area} over the last month.`;
    case "STABLE":
      return `Holding steady in ${area} — skills are being maintained.`;
    case "DECLINING":
      return `${DOMAIN_LABELS[domain]} has been harder recently; the care team is giving extra support.`;
    default:
      return `Still building up a picture in ${area}.`;
  }
}
