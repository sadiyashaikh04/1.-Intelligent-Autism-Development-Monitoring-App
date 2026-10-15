import type { ResidentStatus } from "@/data/types";

/**
 * The resident status machine (parent spec §4.3) as a single allow-list.
 * Adding a status means editing this table and nothing else.
 */
const RESIDENT_TRANSITIONS: Record<ResidentStatus, ResidentStatus[]> = {
  IMPORTED: ["ENROLLED"],
  ENROLLED: ["CSC_ASSIGNED"],
  CSC_ASSIGNED: ["MDT_ASSIGNED"],
  MDT_ASSIGNED: ["ASSESSMENTS_SCHEDULED"],
  ASSESSMENTS_SCHEDULED: ["ASSESSMENTS_IN_PROGRESS"],
  ASSESSMENTS_IN_PROGRESS: ["ASSESSMENTS_COMPLETED"],
  ASSESSMENTS_COMPLETED: ["IEP_IN_PROGRESS"],
  IEP_IN_PROGRESS: ["IEP_APPROVED"],
  IEP_APPROVED: ["ACTIVE"],
  ACTIVE: ["INACTIVE"],
  INACTIVE: ["ACTIVE"],
};

/**
 * Transitions a CSC triggers with a button. Every other transition happens
 * as a side effect of a workflow (scheduling an assessment, approving an
 * IEP) so the status can never drift from what actually happened.
 */
const MANUAL: ReadonlySet<`${ResidentStatus}>${ResidentStatus}`> = new Set([
  "IMPORTED>ENROLLED",
  "ENROLLED>CSC_ASSIGNED",
  "CSC_ASSIGNED>MDT_ASSIGNED",
  "ACTIVE>INACTIVE",
  "INACTIVE>ACTIVE",
] as const);

export function canTransitionResident(
  from: ResidentStatus,
  to: ResidentStatus,
): boolean {
  return RESIDENT_TRANSITIONS[from].includes(to);
}

export function manualNextStatuses(from: ResidentStatus): ResidentStatus[] {
  return RESIDENT_TRANSITIONS[from].filter((to) =>
    MANUAL.has(`${from}>${to}`),
  );
}

/** Ordered journey, for progress displays. INACTIVE is off the path. */
export const RESIDENT_JOURNEY: ResidentStatus[] = [
  "IMPORTED",
  "ENROLLED",
  "CSC_ASSIGNED",
  "MDT_ASSIGNED",
  "ASSESSMENTS_SCHEDULED",
  "ASSESSMENTS_IN_PROGRESS",
  "ASSESSMENTS_COMPLETED",
  "IEP_IN_PROGRESS",
  "IEP_APPROVED",
  "ACTIVE",
];
