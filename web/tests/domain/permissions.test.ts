import { describe, expect, it } from "bun:test";
import {
  can,
  canAccessRoute,
  detailTabsFor,
  navFor,
} from "@/lib/domain/permissions";

const keys = (role: Parameters<typeof navFor>[0]) =>
  navFor(role).map((item) => item.key);

describe("navFor", () => {
  it("gives the PSS a field-work menu without admin pages", () => {
    expect(keys("PSS")).toEqual([
      "dashboard",
      "service-user",
      "adl-tracking",
      "incidents",
      "calendar",
      "notifications",
    ]);
  });

  it("gives the parent only their child and notifications", () => {
    expect(keys("PARENT")).toEqual(["my-child", "notifications"]);
  });

  it("gives user management to the super admin", () => {
    expect(keys("SUPER_ADMIN")).toContain("user-management");
    expect(keys("SUPER_ADMIN")).toContain("catalogues");
  });

  it("never shows insights to PSS or parent", () => {
    expect(keys("PSS")).not.toContain("insights");
    expect(keys("PARENT")).not.toContain("insights");
  });

  it("labels the PSS dashboard 'Today'", () => {
    expect(navFor("PSS")[0]?.label).toBe("Today");
  });
});

describe("canAccessRoute", () => {
  it("blocks a PSS from user management by URL", () => {
    expect(canAccessRoute("PSS", "/user-management")).toBe(false);
  });

  it("allows nested routes under an allowed section", () => {
    expect(canAccessRoute("PSS", "/service-user/r-09")).toBe(true);
    expect(canAccessRoute("CSC", "/incidents/i-01")).toBe(true);
  });

  it("allows reporting an incident only to roles that may report", () => {
    expect(canAccessRoute("PSS", "/incidents/new")).toBe(true);
    expect(canAccessRoute("CSC", "/incidents/new")).toBe(true);
    expect(canAccessRoute("MDT_HEAD", "/incidents/new")).toBe(false);
  });

  it("keeps a parent out of the staff resident list", () => {
    expect(canAccessRoute("PARENT", "/service-user")).toBe(false);
    expect(canAccessRoute("PARENT", "/my-child")).toBe(true);
  });

  it("rejects unknown sections", () => {
    expect(canAccessRoute("SUPER_ADMIN", "/no-such-page")).toBe(false);
  });
});

describe("detailTabsFor", () => {
  it("hides the assessments tab from a PSS", () => {
    expect(detailTabsFor("PSS")).not.toContain("assessments");
    expect(detailTabsFor("PSS")).toContain("adl");
  });

  it("shows every tab to a CSC", () => {
    expect(detailTabsFor("CSC")).toEqual([
      "overview",
      "history",
      "care-team",
      "assessments",
      "iep",
      "adl",
      "development",
    ]);
  });
});

describe("can", () => {
  it("encodes who approves what", () => {
    expect(can("MDT_HEAD", "assessment.review")).toBe(true);
    expect(can("JR_PSYCHOLOGIST", "assessment.review")).toBe(false);
    expect(can("CSC", "adl.review")).toBe(true);
    expect(can("PSS", "adl.log")).toBe(true);
    expect(can("PSS", "insights.risk")).toBe(false);
    expect(can("PARENT", "incident.report")).toBe(false);
  });
});
