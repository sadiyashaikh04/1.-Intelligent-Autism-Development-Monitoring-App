import { afterAll, describe, expect, it } from "bun:test";
import {
  disconnectPrisma,
  prisma,
  schemaFromUrl,
} from "@/adapters/database/prisma";

afterAll(async () => {
  await disconnectPrisma();
});

describe("prisma adapter", () => {
  it("connects and answers a trivial query", async () => {
    const result = await prisma.$queryRaw<
      Array<{ ok: number }>
    >`SELECT 1 as ok`;
    expect(result[0]?.ok).toBe(1);
  });

  it("returns the same instance on repeated imports", async () => {
    const again = await import("@/adapters/database/prisma");
    expect(again.prisma).toBe(prisma);
  });

  // The pg driver ignores Prisma's `?schema=` URL parameter, so the
  // adapter must read it and pass it on — otherwise a test pointed at a
  // throwaway schema silently writes to `public`.
  it("reads the target schema from the connection string", () => {
    expect(
      schemaFromUrl("postgresql://u:p@localhost:5432/iadm?schema=seedproof"),
    ).toBe("seedproof");
    expect(schemaFromUrl("postgresql://u:p@localhost:5432/iadm")).toBe(
      undefined,
    );
  });

  it("exposes every model the schema defines", () => {
    expect(prisma.user).toBeDefined();
    expect(prisma.resident).toBeDefined();
    expect(prisma.assessment).toBeDefined();
    expect(prisma.iepPlan).toBeDefined();
    expect(prisma.adlLog).toBeDefined();
    expect(prisma.calendarSlot).toBeDefined();
    expect(prisma.incident).toBeDefined();
    expect(prisma.developmentSnapshot).toBeDefined();
    expect(prisma.riskAssessment).toBeDefined();
  });
});
