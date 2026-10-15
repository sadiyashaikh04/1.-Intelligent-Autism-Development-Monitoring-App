import type { UserRole } from "@/data/types";

/**
 * Role → what the UI offers, encoding the permission matrix in parent spec
 * §3.1. Route access and action buttons both read from here, so a page can
 * never show a button its role is not allowed to press.
 *
 * Resident *scoping* (a PSS sees only assigned residents) is not here — it
 * lives in queries.ts, because it depends on data, not just the role.
 */

export type NavKey =
  | "dashboard"
  | "service-user"
  | "assessment"
  | "iep"
  | "adl-tracking"
  | "calendar"
  | "incidents"
  | "insights"
  | "notifications"
  | "user-management"
  | "catalogues"
  | "my-child";

export type DetailTab =
  | "overview"
  | "history"
  | "care-team"
  | "assessments"
  | "iep"
  | "adl"
  | "development";

export type Action =
  | "resident.advance"
  | "assessment.schedule"
  | "assessment.conduct"
  | "assessment.review"
  | "iep.author"
  | "iep.review"
  | "iep.activate"
  | "adl.log"
  | "adl.review"
  | "goal.log"
  | "incident.report"
  | "incident.review"
  | "incident.close"
  | "user.manage"
  | "insights.risk";

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
}

const NAV_KEYS: Record<UserRole, NavKey[]> = {
  SUPER_ADMIN: [
    "dashboard",
    "service-user",
    "user-management",
    "catalogues",
    "calendar",
    "incidents",
    "insights",
    "notifications",
  ],
  CSC: [
    "dashboard",
    "service-user",
    "assessment",
    "iep",
    "adl-tracking",
    "calendar",
    "incidents",
    "insights",
    "user-management",
    "notifications",
  ],
  JR_PSYCHOLOGIST: [
    "dashboard",
    "service-user",
    "assessment",
    "iep",
    "calendar",
    "insights",
    "notifications",
  ],
  MDT_HEAD: [
    "dashboard",
    "service-user",
    "assessment",
    "iep",
    "incidents",
    "insights",
    "user-management",
    "notifications",
  ],
  PSS: [
    "dashboard",
    "service-user",
    "adl-tracking",
    "incidents",
    "calendar",
    "notifications",
  ],
  PARENT: ["my-child", "notifications"],
};

const DEFAULT_LABELS: Record<NavKey, string> = {
  dashboard: "Dashboard",
  "service-user": "Service Users",
  assessment: "Assessments",
  iep: "IEP Plans",
  "adl-tracking": "ADL Tracking",
  calendar: "Calendar",
  incidents: "Incidents",
  insights: "Insights",
  notifications: "Notifications",
  "user-management": "Users",
  catalogues: "Catalogues",
  "my-child": "My Child",
};

/** Per-role wording, so each menu reads like that person's job. */
const LABEL_OVERRIDES: Partial<Record<UserRole, Partial<Record<NavKey, string>>>> =
  {
    PSS: {
      dashboard: "Today",
      "service-user": "My Service Users",
      "adl-tracking": "Log Activities",
    },
    JR_PSYCHOLOGIST: {
      "service-user": "My Service Users",
      assessment: "My Assessments",
      iep: "IEP Builder",
    },
    MDT_HEAD: {
      assessment: "Assessment Reviews",
      iep: "Goal Approvals",
      incidents: "Incident Review",
    },
    CSC: { "adl-tracking": "ADL Approvals" },
  };

export function navFor(role: UserRole): NavItem[] {
  return NAV_KEYS[role].map((key) => ({
    key,
    label: LABEL_OVERRIDES[role]?.[key] ?? DEFAULT_LABELS[key],
    href: `/${key}`,
  }));
}

const ACTIONS: Record<UserRole, Action[]> = {
  SUPER_ADMIN: ["user.manage", "insights.risk"],
  CSC: [
    "resident.advance",
    "assessment.schedule",
    "iep.activate",
    "adl.review",
    "incident.report",
    "incident.close",
    "insights.risk",
  ],
  JR_PSYCHOLOGIST: ["assessment.conduct", "iep.author", "insights.risk"],
  MDT_HEAD: [
    "assessment.review",
    "iep.review",
    "incident.review",
    "insights.risk",
  ],
  PSS: ["adl.log", "goal.log", "incident.report"],
  PARENT: [],
};

export function can(role: UserRole, action: Action): boolean {
  return ACTIONS[role].includes(action);
}

/**
 * Whether a role may open a path. The first segment must be one of the
 * role's nav sections; a few sub-routes additionally need an action.
 */
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const [section, sub] = segments;
  if (!section) return true;
  if (!NAV_KEYS[role].includes(section as NavKey)) return false;
  if (section === "incidents" && sub === "new") {
    return can(role, "incident.report");
  }
  return true;
}

const ALL_TABS: DetailTab[] = [
  "overview",
  "history",
  "care-team",
  "assessments",
  "iep",
  "adl",
  "development",
];

export function detailTabsFor(role: UserRole): DetailTab[] {
  switch (role) {
    case "PSS":
      return ["overview", "history", "care-team", "iep", "adl", "development"];
    case "PARENT":
      return ["overview", "care-team", "iep"];
    default:
      return ALL_TABS;
  }
}

/** Where a role lands after signing in. */
export function homeFor(role: UserRole): string {
  return role === "PARENT" ? "/my-child" : "/dashboard";
}
