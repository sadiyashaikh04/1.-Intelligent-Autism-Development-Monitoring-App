import { describe, expect, it } from "bun:test";
import {
  canTransitionResident,
  manualNextStatuses,
} from "@/lib/domain/transitions";

describe("resident status machine", () => {
  it("allows the next step of the enrolment path", () => {
    expect(canTransitionResident("IMPORTED", "ENROLLED")).toBe(true);
    expect(canTransitionResident("IEP_APPROVED", "ACTIVE")).toBe(true);
  });

  it("refuses skipping ahead", () => {
    expect(canTransitionResident("IMPORTED", "ACTIVE")).toBe(false);
    expect(canTransitionResident("ENROLLED", "MDT_ASSIGNED")).toBe(false);
  });

  it("refuses going backwards", () => {
    expect(canTransitionResident("ACTIVE", "IEP_APPROVED")).toBe(false);
  });

  it("toggles between active and inactive", () => {
    expect(canTransitionResident("ACTIVE", "INACTIVE")).toBe(true);
    expect(canTransitionResident("INACTIVE", "ACTIVE")).toBe(true);
  });

  it("offers a CSC only the manual steps, not workflow-driven ones", () => {
    expect(manualNextStatuses("IMPORTED")).toEqual(["ENROLLED"]);
    expect(manualNextStatuses("ACTIVE")).toEqual(["INACTIVE"]);
    // Reached by scheduling an assessment, not by a button.
    expect(manualNextStatuses("MDT_ASSIGNED")).toEqual([]);
  });
});
