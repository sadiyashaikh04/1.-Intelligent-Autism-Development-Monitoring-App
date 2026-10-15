"use client";

import { useCallback, useMemo } from "react";
import type { DemoDb, Viewer } from "@/data/types";
import * as mutations from "@/lib/domain/mutations";
import type { Mutation } from "@/lib/domain/mutations";
import { useDemoAuth } from "@/stores/demo-auth-store";
import { useDemoData } from "@/stores/demo-data-store";

/**
 * THE seam between pages and data. Pages import from here and nowhere else
 * for data: read with `useQuery(listX, args)`, write with `useActions()`.
 * Today it is backed by the in-browser sample database; in later phases
 * these hooks call the backend instead and pages do not change.
 */

export * from "@/lib/domain/queries";
/** Static catalogue content (rubric items, goal suggestions). */
export { ASSESSMENT_ITEMS, GOAL_TEMPLATES } from "@/data/seed/catalogues";

export function useViewer(): Viewer | null {
  const userId = useDemoAuth((s) => s.userId);
  const users = useDemoData((s) => s.db.users);
  return useMemo(() => {
    const u = users.find((x) => x.id === userId);
    return u
      ? { id: u.id, role: u.role, firstName: u.firstName, lastName: u.lastName, email: u.email }
      : null;
  }, [users, userId]);
}

/** Viewer inside the protected layout, where one is guaranteed. */
export function useRequiredViewer(): Viewer {
  const viewer = useViewer();
  if (!viewer) throw new Error("useRequiredViewer outside a signed-in page");
  return viewer;
}

export function useQuery<A extends unknown[], R>(
  query: (db: DemoDb, viewer: Viewer, ...args: A) => R,
  ...args: A
): R {
  const db = useDemoData((s) => s.db);
  const viewer = useRequiredViewer();
  const key = JSON.stringify(args);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- args are keyed by value
  return useMemo(() => query(db, viewer, ...args), [db, viewer, query, key]);
}

type ActionResult = { ok: boolean; error?: string; createdId?: string };
type MutationArgs<M> = M extends Mutation<infer A> ? A : never;
type Actions = {
  [K in keyof typeof mutations as (typeof mutations)[K] extends Mutation<never>
    ? K
    : never]: (args: MutationArgs<(typeof mutations)[K]>) => ActionResult;
};

const MUTATIONS = mutations as unknown as Record<string, Mutation<unknown>>;

export function useActions(): Actions {
  const run = useDemoData((s) => s.run);
  const viewer = useRequiredViewer();
  return useMemo(() => {
    const bound: Record<string, (args: unknown) => ActionResult> = {};
    for (const [name, mutation] of Object.entries(MUTATIONS)) {
      if (typeof mutation !== "function") continue;
      bound[name] = (args) => {
        const result = run(mutation, viewer, args);
        return { ok: !result.error, error: result.error, createdId: result.createdId };
      };
    }
    return bound as unknown as Actions;
  }, [run, viewer]);
}

export function useResetDemo(): () => void {
  const reset = useDemoData((s) => s.reset);
  return useCallback(() => reset(), [reset]);
}
