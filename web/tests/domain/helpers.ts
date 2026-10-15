import { buildDemoDb } from "@/data/seed";
import type { DemoDb, Viewer } from "@/data/types";

/** A fixed "today" so every test sees the same sample data. */
export const TODAY = new Date("2026-10-15T09:00:00.000Z");

export function freshDb(): DemoDb {
  return buildDemoDb(TODAY);
}

export function viewer(db: DemoDb, userId: string): Viewer {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error(`no user ${userId}`);
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
}
