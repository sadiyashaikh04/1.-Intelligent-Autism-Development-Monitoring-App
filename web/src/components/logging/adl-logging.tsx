"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Select, Textarea } from "@/components/ui/form";
import { Card, Chip, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import type { AdlLogStatus, AdlMood, PromptLevel, Shift } from "@/data/types";
import { listAdlAssignments, listAdlLogs, listResidents, useActions, useQuery } from "@/lib/data-source";
import { adlApprovalTone, humanize } from "@/lib/domain/labels";
import { currentShift, formatDate, localIsoDate } from "@/lib/format";
import { EMPTY_DRAFT, useAdlDrafts } from "@/stores/adl-draft-store";
import { PROMPT_LEVELS } from "./goal-progress-dialog";

const STATUS_OPTIONS: Array<{ value: AdlLogStatus; label: string; tone: string }> = [
  { value: "DONE", label: "Done", tone: "bg-emerald-600 text-white ring-emerald-600" },
  { value: "IN_PROGRESS_ADL", label: "Partly", tone: "bg-amber-500 text-white ring-amber-500" },
  { value: "TODO", label: "Not done", tone: "bg-slate-600 text-white ring-slate-600" },
];

const MOOD_OPTIONS: Array<{ value: AdlMood; label: string; tone: string }> = [
  { value: "CALM", label: "Calm", tone: "bg-emerald-600 text-white ring-emerald-600" },
  { value: "ANXIOUS", label: "Anxious", tone: "bg-amber-500 text-white ring-amber-500" },
  { value: "ESCALATED", label: "Escalated", tone: "bg-orange-600 text-white ring-orange-600" },
  { value: "MELTDOWN", label: "Meltdown", tone: "bg-rose-600 text-white ring-rose-600" },
];

const SHIFTS: Shift[] = ["MORNING", "EVENING", "NIGHT"];

/**
 * PSS logging screen — the system's primary daily-use path, built
 * mobile-first (parent spec §2.3): single column at 360px, 44px targets,
 * defaults to today + current shift, native selects, sticky submit.
 */
export function AdlLogging() {
  const actions = useActions();
  const residents = useQuery(listResidents, { status: "ACTIVE" });
  const [residentId, setResidentId] = useState(residents[0]?.id ?? "");
  const [date, setDate] = useState(localIsoDate());
  const [shift, setShift] = useState<Shift>(currentShift());
  const [changingWhen, setChangingWhen] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const assignments = useQuery(listAdlAssignments, residentId);
  const logsToday = useQuery(listAdlLogs, { residentId, logDate: date });
  const { drafts, update, clear } = useAdlDrafts();

  const keyOf = (assignmentId: string) => `${assignmentId}|${date}|${shift}`;
  const rowFor = (assignmentId: string) =>
    logsToday.find((row) => row.log.adlAssignmentId === assignmentId && row.log.shift === shift);
  // A returned (rejected) log is open for correction, not "done".
  const loggedFor = (assignmentId: string) => {
    const row = rowFor(assignmentId);
    return row && row.log.approvalStatus !== "REJECTED" ? row : undefined;
  };
  const ready = assignments.filter(
    (a) => !loggedFor(a.assignment.id) && drafts[keyOf(a.assignment.id)]?.status,
  );

  function submitAll() {
    const errors: string[] = [];
    const done: string[] = [];
    for (const { assignment, activity } of ready) {
      const key = keyOf(assignment.id);
      const d = drafts[key]!;
      const result = actions.createAdlLog({
        adlAssignmentId: assignment.id,
        logDate: date,
        shift,
        status: d.status!,
        promptLevel: d.promptLevel,
        mood: d.mood,
        notes: d.notes,
      });
      if (result.ok) done.push(key);
      else errors.push(`${activity?.name}: ${result.error}`);
    }
    clear(done);
    setMessage(
      errors.length
        ? { tone: "danger", text: errors.join(" ") }
        : { tone: "success", text: `${done.length} ${done.length === 1 ? "log" : "logs"} submitted for approval.` },
    );
  }

  if (residents.length === 0) {
    return (
      <>
        <PageHeader title="Log activities" />
        <EmptyState title="No active service users assigned to you" body="Logging opens once a care plan is active." />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <PageHeader title="Log activities" />

      <div className="space-y-3">
        <Field label="Service user" htmlFor="adl-resident">
          <Select
            id="adl-resident"
            value={residentId}
            onChange={(e) => {
              setResidentId(e.target.value);
              setMessage(null);
            }}
          >
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.firstName} {r.lastName} · {r.code}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-brand-50 px-3 py-2">
          <p className="text-sm text-brand-800">
            <strong>{date === localIsoDate() ? "Today" : formatDate(date)}</strong> · {humanize(shift)} shift
          </p>
          <button
            onClick={() => setChangingWhen((v) => !v)}
            className="min-h-11 px-2 text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            {changingWhen ? "Done" : "Change"}
          </button>
        </div>
        {changingWhen && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="adl-date">
              <Input
                id="adl-date"
                type="date"
                max={localIsoDate()}
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </Field>
            <Field label="Shift" htmlFor="adl-shift">
              <Select id="adl-shift" value={shift} onChange={(e) => setShift(e.target.value as Shift)}>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>

      <ul className="mt-4 space-y-3">
        {assignments.length === 0 && (
          <li>
            <EmptyState title="No activities assigned yet" body="The coordinator assigns daily activities when the plan is activated." />
          </li>
        )}
        {assignments.map(({ assignment, activity }) => {
          const logged = loggedFor(assignment.id);
          const key = keyOf(assignment.id);
          const draft = drafts[key] ?? EMPTY_DRAFT;
          return (
            <li key={assignment.id}>
              <Card>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-ink-900">{activity?.name}</h2>
                  {logged && <Chip tone={adlApprovalTone(logged.log.approvalStatus)}>{humanize(logged.log.approvalStatus)}</Chip>}
                </div>
                {logged ? (
                  <p className="text-sm text-ink-500">
                    Logged: {humanize(logged.log.status)}
                    {logged.log.promptLevel && ` · ${humanize(logged.log.promptLevel)}`}
                    {logged.log.mood && ` · ${humanize(logged.log.mood)}`}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rowFor(assignment.id)?.log.rejectionReason && (
                      <Notice tone="warning">
                        Returned by the coordinator: {rowFor(assignment.id)?.log.rejectionReason}. Correct and resubmit.
                      </Notice>
                    )}
                    <Segmented
                      name={`${activity?.name} status`}
                      value={draft.status}
                      options={STATUS_OPTIONS}
                      onChange={(status) => update(key, { status })}
                    />
                    <div>
                      <p className="mb-1.5 text-sm font-medium text-ink-700">Mood</p>
                      <Segmented
                        name={`${activity?.name} mood`}
                        value={draft.mood}
                        options={MOOD_OPTIONS}
                        onChange={(mood) => update(key, { mood })}
                      />
                    </div>
                    <details className="group">
                      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-700">
                        Help level & notes
                      </summary>
                      <div className="mt-2 space-y-3">
                        <Field label="Level of help" htmlFor={`${key}-prompt`}>
                          <Select
                            id={`${key}-prompt`}
                            value={draft.promptLevel}
                            onChange={(e) => update(key, { promptLevel: e.target.value as PromptLevel })}
                          >
                            {PROMPT_LEVELS.map((p) => (
                              <option key={p} value={p}>
                                {humanize(p)}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Notes" htmlFor={`${key}-notes`}>
                          <Textarea id={`${key}-notes`} value={draft.notes} onChange={(e) => update(key, { notes: e.target.value })} />
                        </Field>
                      </div>
                    </details>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 p-3 backdrop-blur lg:left-60">
        <div className="mx-auto max-w-2xl">
          <Button size="lg" className="w-full" disabled={ready.length === 0} onClick={submitAll}>
            {ready.length === 0 ? "Tap a status to start" : `Submit ${ready.length} ${ready.length === 1 ? "log" : "logs"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
