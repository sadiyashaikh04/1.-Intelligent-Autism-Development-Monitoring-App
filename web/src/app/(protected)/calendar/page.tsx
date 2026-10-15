"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import type { SlotType } from "@/data/types";
import { listCalendarSlots, useQuery, useRequiredViewer, type SlotRow } from "@/lib/data-source";
import { formatTime24, formatWeekday, fullName } from "@/lib/format";

const SLOT_STYLE: Record<SlotType, string> = {
  ASSESSMENT_SLOT: "bg-sky-50 text-sky-900 ring-sky-200",
  THERAPY_SESSION: "bg-brand-50 text-brand-800 ring-brand-200",
  IPP_ACTIVITY: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  IPP_MEETING_SLOT: "bg-amber-50 text-amber-900 ring-amber-200",
  GENERAL_SLOT: "bg-slate-100 text-slate-800 ring-slate-200",
};

const SLOT_LABELS: Record<SlotType, string> = {
  ASSESSMENT_SLOT: "Assessment",
  THERAPY_SESSION: "Therapy",
  IPP_ACTIVITY: "IEP practice",
  IPP_MEETING_SLOT: "IEP meeting",
  GENERAL_SLOT: "General",
};

function mondayOf(d: Date) {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

function SlotChip({ row, compact = false }: { row: SlotRow; compact?: boolean }) {
  const { slot, resident, room, staff } = row;
  const detail = `${room?.name ?? "No room"} · ${fullName(staff)}`;
  return (
    <div
      title={compact ? `${slot.title}${resident ? ` — ${fullName(resident)}` : ""}\n${detail}` : undefined}
      className={`rounded-lg px-2 py-1.5 text-xs ring-1 ring-inset ${SLOT_STYLE[slot.type]} ${slot.status === "COMPLETED_SLOT" ? "opacity-60" : ""}`}
    >
      <p className="truncate">
        <span className="font-semibold tabular-nums">{formatTime24(slot.startsAt)}</span> {slot.title}
      </p>
      {resident && <p className="truncate font-medium">{resident.firstName} {resident.lastName}</p>}
      {!compact && <p className="truncate opacity-80">{detail}</p>}
    </div>
  );
}

export default function CalendarPage() {
  const viewer = useRequiredViewer();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const slots = useQuery(listCalendarSlots, weekStart);
  const [type, setType] = useState<SlotType | "">("");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }),
    [weekStart],
  );
  const visible = slots.filter((s) => !type || s.slot.type === type);
  const onDay = (d: Date) => visible.filter((s) => new Date(s.slot.startsAt).toDateString() === d.toDateString());
  const shift = (weeks: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + weeks * 7);
    setWeekStart(d);
  };
  const today = new Date().toDateString();
  const seeAll = ["SUPER_ADMIN", "CSC", "MDT_HEAD"].includes(viewer.role);

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={seeAll ? "All rooms and staff" : viewer.role === "PARENT" ? "Your child's sessions" : "Your sessions"}
        actions={
          <>
            <Button variant="secondary" onClick={() => shift(-1)} aria-label="Previous week">←</Button>
            <Button variant="secondary" onClick={() => setWeekStart(mondayOf(new Date()))}>This week</Button>
            <Button variant="secondary" onClick={() => shift(1)} aria-label="Next week">→</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="mr-2 text-sm font-medium text-ink-700">
          {formatWeekday(days[0]!)} – {formatWeekday(days[6]!)}
        </p>
        {(["", ...Object.keys(SLOT_STYLE)] as Array<SlotType | "">).map((t) => (
          <button
            key={t || "all"}
            onClick={() => setType(t)}
            className={`min-h-9 rounded-full px-3 text-xs font-medium ring-1 ring-inset ${
              type === t ? "bg-ink-900 text-white ring-ink-900" : "bg-surface text-ink-700 ring-line hover:bg-slate-50"
            }`}
          >
            {t ? SLOT_LABELS[t] : "All"}
          </button>
        ))}
      </div>

      {/* Week grid on wide screens, day list on phones. */}
      <div className="hidden gap-2 xl:grid xl:grid-cols-7">
        {days.map((d) => (
          <div key={d.toISOString()} className={`min-h-48 rounded-xl p-2 ring-1 ring-line ${d.toDateString() === today ? "bg-brand-50/50 ring-brand-200" : "bg-surface"}`}>
            <p className={`mb-2 px-1 text-xs font-semibold ${d.toDateString() === today ? "text-brand-700" : "text-ink-500"}`}>
              {formatWeekday(d)}
            </p>
            <div className="space-y-1.5">
              {onDay(d).map((row) => <SlotChip key={row.slot.id} row={row} compact />)}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-4 xl:hidden">
        {days.map((d) => {
          const rows = onDay(d);
          return (
            <section key={d.toISOString()}>
              <h2 className={`mb-2 text-sm font-semibold ${d.toDateString() === today ? "text-brand-700" : "text-ink-700"}`}>
                {formatWeekday(d)} {d.toDateString() === today && "· Today"}
              </h2>
              {rows.length === 0 ? (
                <p className="text-sm text-ink-400">Nothing scheduled</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">{rows.map((row) => <SlotChip key={row.slot.id} row={row} />)}</div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
