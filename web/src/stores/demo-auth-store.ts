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
}

export const useDemoAuth = create<DemoAuthState>()(
  persist(
    (set) => ({
      userId: null,
      hydrated: false,
      signIn: (userId) => set({ userId }),
      signOut: () => set({ userId: null }),
    }),
    {
      name: "iadm-demo-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ userId: state.userId }),
      onRehydrateStorage: () => () => {
        useDemoAuth.setState({ hydrated: true });
      },
    },
  ),
);
