"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildDemoDb } from "@/data/seed";
import type { DemoDb, Viewer } from "@/data/types";
import type { Mutation, MutationResult } from "@/lib/domain/mutations";

/**
 * The in-browser sample database. Persisted to sessionStorage so a demo
 * that hops between roles survives a page refresh; "Reset demo data"
 * rebuilds it from the seed.
 */
interface DemoDataState {
  db: DemoDb;
  run: <A>(mutation: Mutation<A>, viewer: Viewer, args: A) => MutationResult;
  reset: () => void;
}

export const useDemoData = create<DemoDataState>()(
  persist(
    (set, get) => ({
      db: buildDemoDb(new Date()),
      run: (mutation, viewer, args) => {
        const result = mutation(get().db, viewer, args);
        if (!result.error) set({ db: result.db });
        return result;
      },
      reset: () => set({ db: buildDemoDb(new Date()) }),
    }),
    {
      name: "iadm-demo-data",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ db: state.db }),
    },
  ),
);
