"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Demo sign-in only: remembers which seeded user is "logged in" for this
 * browser tab. There is no password check and no token — real
 * authentication arrives in Phase 1.
 */
interface DemoAuthState {
  userId: string | null;
  hydrated: boolean;
  signIn: (userId: string) => void;
  signOut: () => void;
  markHydrated: () => void;
}

export const useDemoAuth = create<DemoAuthState>()(
  persist(
    (set) => ({
      userId: null,
      hydrated: false,
      signIn: (userId) => set({ userId }),
      signOut: () => set({ userId: null }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "iadm-demo-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ userId: state.userId }),
      // sessionStorage is synchronous, so this runs while the store is
      // still being created — go through the state's own setter, not the
      // not-yet-assigned `useDemoAuth` binding.
      onRehydrateStorage: () => (state) => state?.markHydrated(),
    },
  ),
);
