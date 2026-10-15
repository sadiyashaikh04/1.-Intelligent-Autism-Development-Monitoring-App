import { describe, expect, it } from "bun:test";
import {
  getResidentDetail,
  listResidents,
  listRiskBoard,
  unreadCount,
} from "@/lib/domain/queries";
import { freshDb, viewer } from "./helpers";

describe("listResidents scoping", () => {
  it("shows a CSC every resident", () => {
    const db = freshDb();
    expect(listResidents(db, viewer(db, "u-csc1"), {})).toHaveLength(
      db.residents.length,
    );
  });

  it("shows a PSS only residents they are actively assigned to", () => {
    const db = freshDb();
    const pss = viewer(db, "u-pss1");
    const assigned = new Set(
      db.staffAssignments
        .filter((a) => a.userId === pss.id && a.unassignedAt === null)
        .map((a) => a.residentId),
    );
    const visible = listResidents(db, pss, {});
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(db.residents.length);
    for (const resident of visible) expect(assigned.has(resident.id)).toBe(true);
  });

  it("filters by search text on code or name, case-insensitively", () => {
    const db = freshDb();
    const csc = viewer(db, "u-csc1");
    expect(listResidents(db, csc, { q: "res-0001" }).map((r) => r.code)).toEqual(
      ["RES-0001"],
    );
    expect(listResidents(db, csc, { q: "SHARMA" })[0]?.code).toBe("RES-0001");
  });

  it("filters by status", () => {
    const db = freshDb();
    const result = listResidents(db, viewer(db, "u-csc1"), {
      status: "IMPORTED",
    });
    expect(result).toHaveLength(2);
    for (const r of result) expect(r.status).toBe("IMPORTED");
  });
});

describe("getResidentDetail scoping", () => {
  it("lets a parent open their own child", () => {
    const db = freshDb();
    const parent = viewer(db, "u-parent1");
    const childId = db.residentParents.find(
      (link) => link.parentUserId === parent.id,
    )?.residentId;
    expect(childId).toBeDefined();
    expect(getResidentDetail(db, parent, childId!)).not.toBeNull();
  });

  it("returns null when a parent opens someone else's child", () => {
    const db = freshDb();
    expect(getResidentDetail(db, viewer(db, "u-parent1"), "r-01")).toBeNull();
  });

  it("returns null for an unknown id", () => {
    const db = freshDb();
    expect(getResidentDetail(db, viewer(db, "u-csc1"), "r-999")).toBeNull();
  });

  it("includes history, care team and parents", () => {
    const db = freshDb();
    const detail = getResidentDetail(db, viewer(db, "u-csc1"), "r-09");
    expect(detail?.statusHistory.length).toBeGreaterThan(0);
    expect(detail?.careTeam.length).toBeGreaterThan(0);
    expect(detail?.parents.length).toBe(1);
  });
});

describe("listRiskBoard", () => {
  it("is empty for a PSS — risk bands stay with clinicians", () => {
    const db = freshDb();
    expect(listRiskBoard(db, viewer(db, "u-pss1"))).toEqual([]);
  });

  it("lists the highest risk first for the MDT head", () => {
    const db = freshDb();
    const board = listRiskBoard(db, viewer(db, "u-mdt"));
    expect(board.length).toBeGreaterThan(0);
    expect(board[0]?.risk.band).toBe("HIGH");
  });
});

describe("unreadCount", () => {
  it("counts only the viewer's own unread notifications", () => {
    const db = freshDb();
    const csc = viewer(db, "u-csc1");
    const expected = db.notifications.filter(
      (n) => n.userId === csc.id && n.readAt === null,
    ).length;
    expect(unreadCount(db, csc)).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });
});
