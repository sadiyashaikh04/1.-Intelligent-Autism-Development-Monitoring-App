"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Segmented, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Notice } from "@/components/ui/primitives";
import type { DemoDb, IepLogOutcome, PromptLevel } from "@/data/types";
import { useActions, useQuery } from "@/lib/data-source";
import { humanize } from "@/lib/domain/labels";
import { localIsoDate } from "@/lib/format";

const OUTCOMES: Array<{ value: IepLogOutcome; label: string; tone: string }> = [
  { value: "ACHIEVED_LOG", label: "Achieved", tone: "bg-emerald-600 text-white ring-emerald-600" },
  { value: "PARTIALLY_ACHIEVED_LOG", label: "Partly", tone: "bg-amber-500 text-white ring-amber-500" },
  { value: "NOT_ACHIEVED_LOG", label: "Not yet", tone: "bg-rose-600 text-white ring-rose-600" },
];
export const PROMPT_LEVELS: PromptLevel[] = [
  "INDEPENDENT",
  "VERBAL",
  "GESTURAL",
  "PARTIAL_PHYSICAL",
  "FULL_PHYSICAL",
];

function loggableGoal(db: DemoDb, goalId: string) {
  const goal = db.iepGoals.find((g) => g.id === goalId);
  const plan = db.iepPlans.find((p) => p.id === goal?.iepPlanId);
  // PSS log only the goals they practise; clinician-led goals are logged in sessions.
  const loggable =
    !!goal && plan?.status === "ACTIVE_IEP" && goal.approvalStatus === "APPROVED_MDT" && goal.assignedRole === "PSS";
  return loggable ? goal : null;
}

/** "Log progress" on an approved goal of an active plan; renders nothing otherwise. */
export function GoalProgressButton({ goalId }: { goalId: string }) {
  const goal = useQuery((db) => loggableGoal(db, goalId));
  const actions = useActions();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<IepLogOutcome | null>(null);
  const [promptLevel, setPromptLevel] = useState<PromptLevel>("VERBAL");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!goal) return null;

  function submit() {
    if (!outcome) return;
    const result = actions.logGoalProgress({
      goalId,
      logDate: localIsoDate(),
      outcome,
      promptLevel,
      notes,
    });
    if (!result.ok) return setError(result.error ?? "Could not save.");
    setOpen(false);
    setOutcome(null);
    setNotes("");
    setSaved(true);
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => { setOpen(true); setSaved(false); setError(null); }}>
          Log progress
        </Button>
        {saved && <span className="text-xs font-medium text-emerald-700">Saved for today</span>}
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Progress: ${goal.title}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!outcome}>
              Save
            </Button>
          </>
        }
      >
        <Field label="How did it go today?">
          <Segmented name="Outcome" value={outcome} options={OUTCOMES} onChange={setOutcome} />
        </Field>
        <Field label="Level of help" htmlFor="gp-prompt">
          <Select id="gp-prompt" value={promptLevel} onChange={(e) => setPromptLevel(e.target.value as PromptLevel)}>
            {PROMPT_LEVELS.map((p) => (
              <option key={p} value={p}>
                {humanize(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes (optional)" htmlFor="gp-notes">
          <Textarea id="gp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </Dialog>
    </>
  );
}
