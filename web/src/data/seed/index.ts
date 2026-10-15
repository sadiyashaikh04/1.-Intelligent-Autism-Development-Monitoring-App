import type { DemoDb } from "@/data/types";
import { ADL_ACTIVITIES, ASSESSMENT_TYPES, ROOMS } from "./catalogues";
import { buildAssessments, buildIep } from "./clinical";
import {
  buildAdlAssignments,
  buildAdlLogs,
  buildCalendarSlots,
  buildGoalProgressLogs,
  buildIncidents,
  buildNotifications,
} from "./daily";
import { buildDevelopmentSnapshots, buildRiskAssessments } from "./insights";
import {
  buildResidentParents,
  buildResidents,
  buildStaffAssignments,
  buildStatusHistory,
  buildUsers,
} from "./people";

/**
 * Builds the whole sample database relative to `today`, so the demo always
 * looks current. Deterministic for a given date. ALL DATA IS SYNTHETIC.
 */
export function buildDemoDb(today: Date): DemoDb {
  const users = buildUsers(today);
  const residents = buildResidents(today);
  const staffAssignments = buildStaffAssignments(today, residents);
  const base = { staffAssignments };
  const { iepPlans, iepGoals } = buildIep(today, base);
  const adlAssignments = buildAdlAssignments(base);

  return {
    users,
    residents,
    statusHistory: buildStatusHistory(today, residents),
    staffAssignments,
    residentParents: buildResidentParents(),
    assessmentTypes: ASSESSMENT_TYPES,
    assessments: buildAssessments(today, base),
    iepPlans,
    iepGoals,
    goalProgressLogs: buildGoalProgressLogs(today, {
      staffAssignments,
      iepGoals,
      iepPlans,
    }),
    adlActivities: ADL_ACTIVITIES,
    adlAssignments,
    adlLogs: buildAdlLogs(today, { staffAssignments, adlAssignments }),
    rooms: ROOMS,
    calendarSlots: buildCalendarSlots(today, base),
    incidents: buildIncidents(today),
    notifications: buildNotifications(today),
    developmentSnapshots: buildDevelopmentSnapshots(today, {
      iepGoals,
      iepPlans,
    }),
    riskAssessments: buildRiskAssessments(today),
  };
}
