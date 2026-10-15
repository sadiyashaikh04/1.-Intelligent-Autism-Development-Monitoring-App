import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import { disconnectPrisma, prisma } from "@/adapters/database/prisma";
import { seed } from "../../prisma/seed";

beforeAll(async () => {
  await seed();
});

afterAll(async () => {
  await disconnectPrisma();
});

describe("seed", () => {
  it("creates the 10 residents Phase 0 requires", async () => {
    expect(await prisma.resident.count()).toBe(10);
  });

  it("distributes residents across the status machine", async () => {
    const grouped = await prisma.resident.groupBy({
      by: ["status"],
      _count: true,
    });
    const counts = Object.fromEntries(
      grouped.map((row) => [row.status, row._count]),
    );

    expect(counts.IMPORTED).toBe(2);
    expect(counts.ENROLLED).toBe(1);
    expect(counts.MDT_ASSIGNED).toBe(1);
    expect(counts.ASSESSMENTS_IN_PROGRESS).toBe(2);
    expect(counts.ASSESSMENTS_COMPLETED).toBe(1);
    expect(counts.IEP_IN_PROGRESS).toBe(1);
    expect(counts.ACTIVE).toBe(2);
  });

  it("creates one user for every role", async () => {
    const grouped = await prisma.user.groupBy({ by: ["role"], _count: true });
    const counts = Object.fromEntries(
      grouped.map((row) => [row.role, row._count]),
    );

    expect(counts.SUPER_ADMIN).toBe(1);
    expect(counts.CSC).toBe(2);
    expect(counts.JR_PSYCHOLOGIST).toBe(2);
    expect(counts.MDT_HEAD).toBe(1);
    expect(counts.PSS).toBe(3);
    expect(counts.PARENT).toBe(4);
  });

  it("creates the catalogues", async () => {
    expect(await prisma.assessmentType.count()).toBe(8);
    expect(await prisma.adlActivity.count()).toBe(12);
    expect(await prisma.room.count()).toBe(6);
  });

  it("splits ADL activities into 8 ADL and 4 IADL", async () => {
    expect(await prisma.adlActivity.count({ where: { category: "ADL" } })).toBe(
      8,
    );
    expect(
      await prisma.adlActivity.count({ where: { category: "IADL" } }),
    ).toBe(4);
  });

  it("never stores a plaintext password", async () => {
    const users = await prisma.user.findMany({
      select: { passwordHash: true },
    });
    for (const user of users) {
      expect(user.passwordHash).not.toBe("Password123!");
      expect(user.passwordHash.length).toBeGreaterThan(40);
    }
  });

  it("gives every resident an initial status-history row matching its status", async () => {
    // Spec §4.3: every status is reached via a history row. A seeded
    // resident must not appear to have arrived at its status from nowhere.
    const residents = await prisma.resident.findMany({
      select: {
        status: true,
        statusHistory: { select: { fromStatus: true, toStatus: true } },
      },
    });
    for (const resident of residents) {
      expect(resident.statusHistory).toHaveLength(1);
      expect(resident.statusHistory[0]?.fromStatus).toBeNull();
      expect(resident.statusHistory[0]?.toStatus).toBe(resident.status);
    }
  });

  it("is idempotent — running twice does not duplicate rows", async () => {
    await seed();
    expect(await prisma.resident.count()).toBe(10);
    expect(await prisma.user.count()).toBe(13);
    expect(await prisma.residentStatusHistory.count()).toBe(10);
  });
});
