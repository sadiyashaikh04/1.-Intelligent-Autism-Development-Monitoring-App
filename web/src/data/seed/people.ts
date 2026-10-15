import type {
  Resident,
  ResidentParent,
  ResidentStatus,
  StaffAssignment,
  StatusHistoryEntry,
  User,
} from "@/data/types";
import { RESIDENT_JOURNEY } from "@/lib/domain/transitions";
import { at, dateOffset } from "./helpers";

/** The same 13 people as backend/prisma/seed.ts. */
export function buildUsers(today: Date): User[] {
  const created = at(today, -200, 9);
  const u = (
    id: string,
    email: string,
    firstName: string,
    lastName: string,
    role: User["role"],
    clinicalDomain: User["clinicalDomain"] = null,
  ): User => ({
    id,
    email,
    firstName,
    lastName,
    role,
    clinicalDomain,
    isActive: true,
    createdAt: created,
  });
  return [
    u("u-admin", "admin@iadm.local", "Aisha", "Rahman", "SUPER_ADMIN"),
    u("u-csc1", "csc1@iadm.local", "Priya", "Nair", "CSC"),
    u("u-csc2", "csc2@iadm.local", "Rohan", "Mehta", "CSC"),
    u("u-psych1", "psych1@iadm.local", "Sara", "Khan", "JR_PSYCHOLOGIST", "PSYCHOLOGY"),
    u("u-psych2", "psych2@iadm.local", "Imran", "Sheikh", "JR_PSYCHOLOGIST", "SPEECH_THERAPY"),
    u("u-mdt", "mdthead@iadm.local", "Vikram", "Desai", "MDT_HEAD", "PSYCHOLOGY"),
    u("u-pss1", "pss1@iadm.local", "Meera", "Joshi", "PSS"),
    u("u-pss2", "pss2@iadm.local", "Arjun", "Patel", "PSS"),
    u("u-pss3", "pss3@iadm.local", "Fatima", "Ali", "PSS"),
    u("u-parent1", "parent1@iadm.local", "Deepa", "Iyer", "PARENT"),
    u("u-parent2", "parent2@iadm.local", "Sanjay", "Kulkarni", "PARENT"),
    u("u-parent3", "parent3@iadm.local", "Nadia", "Qureshi", "PARENT"),
    u("u-parent4", "parent4@iadm.local", "Ravi", "Menon", "PARENT"),
  ];
}

type ResidentRow = [
  id: string,
  code: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string,
  gender: Resident["gender"],
  programType: Resident["programType"],
  status: ResidentStatus,
  /** Days ago the resident was created; drives history dates. */
  createdDaysAgo: number,
];

/**
 * RES-0001…RES-0010 match the backend seed exactly. RES-0011…RES-0016 are
 * extra ACTIVE residents that exist only in the demo, so the insights and
 * risk board have enough people on them to be meaningful.
 */
const RESIDENTS: ResidentRow[] = [
  ["r-01", "RES-0001", "Aarav", "Sharma", "2012-03-14", "MALE", "COMMUNITY", "IMPORTED", 3],
  ["r-02", "RES-0002", "Diya", "Kapoor", "2014-07-02", "FEMALE", "COMMUNITY", "IMPORTED", 2],
  ["r-03", "RES-0003", "Kabir", "Rao", "2011-11-23", "MALE", "FAMILY_LIVING", "ENROLLED", 9],
  ["r-04", "RES-0004", "Ananya", "Bose", "2013-01-09", "FEMALE", "COMMUNITY", "MDT_ASSIGNED", 16],
  ["r-05", "RES-0005", "Vivaan", "Reddy", "2010-05-30", "MALE", "FAMILY_LIVING", "ASSESSMENTS_IN_PROGRESS", 30],
  ["r-06", "RES-0006", "Ishita", "Verma", "2012-09-17", "FEMALE", "COMMUNITY", "ASSESSMENTS_IN_PROGRESS", 28],
  ["r-07", "RES-0007", "Aryan", "Gupta", "2011-02-08", "MALE", "COMMUNITY", "ASSESSMENTS_COMPLETED", 45],
  ["r-08", "RES-0008", "Myra", "Chatterjee", "2013-12-25", "FEMALE", "FAMILY_LIVING", "IEP_IN_PROGRESS", 60],
  ["r-09", "RES-0009", "Reyansh", "Pillai", "2010-08-11", "MALE", "COMMUNITY", "ACTIVE", 140],
  ["r-10", "RES-0010", "Saanvi", "Deshmukh", "2012-06-19", "FEMALE", "FAMILY_LIVING", "ACTIVE", 150],
  ["r-11", "RES-0011", "Zara", "Khan", "2011-04-21", "FEMALE", "COMMUNITY", "ACTIVE", 130],
  ["r-12", "RES-0012", "Advik", "Nair", "2013-10-03", "MALE", "FAMILY_LIVING", "ACTIVE", 125],
  ["r-13", "RES-0013", "Kiara", "Sen", "2012-01-27", "FEMALE", "COMMUNITY", "ACTIVE", 135],
  ["r-14", "RES-0014", "Rudra", "Joshi", "2010-12-15", "MALE", "COMMUNITY", "ACTIVE", 120],
  ["r-15", "RES-0015", "Anika", "Das", "2014-02-11", "FEMALE", "FAMILY_LIVING", "ACTIVE", 128],
  ["r-16", "RES-0016", "Shaurya", "Iyer", "2011-08-30", "MALE", "COMMUNITY", "ACTIVE", 40],
];

export const ACTIVE_RESIDENT_IDS = RESIDENTS.filter(
  (r) => r[7] === "ACTIVE",
).map((r) => r[0]);

export function buildResidents(today: Date): Resident[] {
  return RESIDENTS.map(
    ([id, code, firstName, lastName, dob, gender, programType, status, ago]) => ({
      id,
      code,
      firstName,
      lastName,
      dateOfBirth: dob,
      gender,
      programType,
      status,
      admissionDate: status === "ACTIVE" ? dateOffset(today, -ago + 20) : null,
      createdAt: at(today, -ago, 10),
    }),
  );
}

const REASONS: Partial<Record<ResidentStatus, string>> = {
  IMPORTED: "Referral received",
  ENROLLED: "Enrolment documents verified",
  CSC_ASSIGNED: "Coordinator assigned",
  MDT_ASSIGNED: "Care team assigned",
  ASSESSMENTS_SCHEDULED: "Baseline assessments scheduled",
  ASSESSMENTS_IN_PROGRESS: "First assessment started",
  ASSESSMENTS_COMPLETED: "All assessments approved by MDT",
  IEP_IN_PROGRESS: "IEP plan drafting started",
  IEP_APPROVED: "IEP goals approved by MDT",
  ACTIVE: "Plan activated",
};

/** Walks each resident along the journey up to their current status. */
export function buildStatusHistory(
  today: Date,
  residents: Resident[],
): StatusHistoryEntry[] {
  const history: StatusHistoryEntry[] = [];
  for (const resident of residents) {
    const row = RESIDENTS.find((r) => r[0] === resident.id)!;
    const ago = row[8];
    const steps = RESIDENT_JOURNEY.slice(
      0,
      RESIDENT_JOURNEY.indexOf(resident.status) + 1,
    );
    steps.forEach((toStatus, index) => {
      // Spread the steps evenly from creation to (almost) today.
      const daysAgo = Math.round(ago - (index * ago * 0.9) / Math.max(steps.length - 1, 1));
      history.push({
        id: `sh-${resident.id}-${index}`,
        residentId: resident.id,
        fromStatus: index === 0 ? null : (steps[index - 1] ?? null),
        toStatus,
        changedByUserId: index === 0 ? "u-admin" : resident.id < "r-08" ? "u-csc1" : "u-csc2",
        reason: REASONS[toStatus] ?? null,
        createdAt: at(today, -daysAgo, 11),
      });
    });
  }
  return history;
}

const TEAMS: Record<string, { csc: string; psych?: string; pss?: string }> = {
  "r-04": { csc: "u-csc1", psych: "u-psych1", pss: "u-pss1" },
  "r-05": { csc: "u-csc1", psych: "u-psych1", pss: "u-pss1" },
  "r-06": { csc: "u-csc1", psych: "u-psych2", pss: "u-pss2" },
  "r-07": { csc: "u-csc1", psych: "u-psych1", pss: "u-pss2" },
  "r-08": { csc: "u-csc2", psych: "u-psych2", pss: "u-pss3" },
  "r-09": { csc: "u-csc2", psych: "u-psych1", pss: "u-pss1" },
  "r-10": { csc: "u-csc2", psych: "u-psych2", pss: "u-pss2" },
  "r-11": { csc: "u-csc1", psych: "u-psych1", pss: "u-pss1" },
  "r-12": { csc: "u-csc2", psych: "u-psych2", pss: "u-pss2" },
  "r-13": { csc: "u-csc1", psych: "u-psych1", pss: "u-pss1" },
  "r-14": { csc: "u-csc2", psych: "u-psych2", pss: "u-pss2" },
  "r-15": { csc: "u-csc1", psych: "u-psych1", pss: "u-pss3" },
  "r-16": { csc: "u-csc2", psych: "u-psych2", pss: "u-pss3" },
};

export function buildStaffAssignments(
  today: Date,
  residents: Resident[],
): StaffAssignment[] {
  const out: StaffAssignment[] = [];
  for (const resident of residents) {
    const team = TEAMS[resident.id];
    if (!team) continue;
    const assignedAt = at(today, -20, 12);
    const add = (userId: string, role: StaffAssignment["role"]) =>
      out.push({
        id: `sa-${resident.id}-${role}`,
        residentId: resident.id,
        userId,
        role,
        assignedAt,
        unassignedAt: null,
      });
    add(team.csc, "CSC");
    if (team.psych) add(team.psych, "JR_PSYCHOLOGIST");
    if (team.pss) add(team.pss, "PSS");
    add("u-mdt", "MDT_HEAD");
  }
  return out;
}

export function buildResidentParents(): ResidentParent[] {
  return [
    { id: "rp-1", residentId: "r-09", parentUserId: "u-parent1", relationship: "Mother" },
    { id: "rp-2", residentId: "r-10", parentUserId: "u-parent2", relationship: "Father" },
    { id: "rp-3", residentId: "r-08", parentUserId: "u-parent3", relationship: "Mother" },
    { id: "rp-4", residentId: "r-07", parentUserId: "u-parent4", relationship: "Father" },
  ];
}
