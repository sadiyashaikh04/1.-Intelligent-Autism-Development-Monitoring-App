"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AdlLogStatus, AdlMood, PromptLevel } from "@/data/types";

/**
 * Half-filled ADL entries, kept outside the form so a PSS whose phone
 * backgrounds the browser mid-shift doesn't lose them (parent spec §2.3).
 * Keyed by `${assignmentId}|${date}|${shift}`.
 */
export interface AdlDraft {
  status: AdlLogStatus | null;
  promptLevel: PromptLevel;
  mood: AdlMood | null;
  notes: string;
}

export const EMPTY_DRAFT: AdlDraft = { status: null, promptLevel: "VERBAL", mood: null, notes: "" };

interface DraftState {
  drafts: Record<string, AdlDraft>;
  update: (key: string, patch: Partial<AdlDraft>) => void;
  clear: (keys: string[]) => void;
}

export const useAdlDrafts = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      update: (key, patch) =>
        set((s) => ({ drafts: { ...s.drafts, [key]: { ...EMPTY_DRAFT, ...s.drafts[key], ...patch } } })),
      clear: (keys) =>
        set((s) => {
          const drafts = { ...s.drafts };
          for (const k of keys) delete drafts[k];
          return { drafts };
        }),
    }),
    { name: "iadm-adl-drafts", storage: createJSONStorage(() => sessionStorage) },
  ),
);
