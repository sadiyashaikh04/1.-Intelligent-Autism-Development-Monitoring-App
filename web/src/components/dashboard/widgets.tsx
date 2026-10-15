"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ResidentStatusChip } from "@/components/residents/status";
import { Bar, Card, CardTitle, Chip } from "@/components/ui/primitives";
import { TONE_DOT } from "@/config/theme";
import type { Resident, ResidentStatus } from "@/data/types";
import {
  listCalendarSlots,
  listDeclineFlags,
  listRiskBoard,
  useQuery,
} from "@/lib/data-source";
import {
  DOMAIN_LABELS,
  RESIDENT_STATUS_LABELS,
  humanize,
  residentStatusTone,
  riskTone,
  type Tone,
} from "@/lib/domain/labels";
import { RESIDENT_JOURNEY } from "@/lib/domain/transitions";
import { formatTime, fullName } from "@/lib/format";

export function StatCard({
  label,
  value,
  href,
  tone = "brand",
  hint,
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: Tone;
  hint?: string;
}) {
  const body = (
    <div className="flex h-full flex-col rounded-xl bg-surface p-4 shadow-sm ring-1 ring-line transition hover:ring-brand-200">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${TONE_DOT[tone]}`} />
        <p className="text-sm font-medium text-ink-500">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-ink-900">{value}</p>
      {hint && <p className="mt-auto pt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function ResidentsByStatus({ residents }: { residents: Resident[] }) {
  const statuses: ResidentStatus[] = [...RESIDENT_JOURNEY, "INACTIVE"];
  const max = Math.max(1, ...statuses.map((s) => residents.filter((r) => r.status === s).length));
  return (
    <Card>
      <CardTitle action={<Link href="/service-user" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>}>
        Service users by stage
      </CardTitle>
      <ul className="space-y-2">
        {statuses.map((s) => {
          const n = residents.filter((r) => r.status === s).length;
          if (n === 0) return null;
          return (
            <li key={s} className="grid grid-cols-[minmax(0,12.5rem)_1fr_2rem] items-center gap-3 text-sm">
              <span className="truncate text-ink-700">{RESIDENT_STATUS_LABELS[s]}</span>
              <Bar value={n / max} tone={residentStatusTone(s)} />
              <span className="text-right tabular-nums text-ink-900">{n}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function TodaySlots({ title = "Today's schedule" }: { title?: string }) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const week = useQuery(listCalendarSlots, start);
  const today = week.filter((s) => new Date(s.slot.startsAt).toDateString() === new Date().toDateString());
  return (
    <Card>
      <CardTitle action={<Link href="/calendar" className="text-sm font-medium text-brand-700 hover:underline">Calendar</Link>}>
        {title}
      </CardTitle>
      {today.length === 0 ? (
        <p className="text-sm text-ink-500">Nothing scheduled for today.</p>
      ) : (
        <ul className="divide-y divide-line">
          {today.slice(0, 6).map(({ slot, resident, room }) => (
            <li key={slot.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-[4.5rem] shrink-0 whitespace-nowrap tabular-nums text-ink-500">{formatTime(slot.startsAt)}</span>
              <span className="min-w-0 flex-1 truncate text-ink-900">
                {slot.title}
                {resident && ` · ${resident.firstName} ${resident.lastName.charAt(0)}.`}
              </span>
              <span className="hidden truncate text-xs text-ink-500 sm:block">{room?.name}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Top clinical flags. Every flag shows why; the model never acts. */
export function FlagsCard() {
  const risks = useQuery(listRiskBoard).filter((r) => r.risk.band !== "LOW");
  const declines = useQuery(listDeclineFlags);
  return (
    <Card>
      <CardTitle action={<Link href="/insights" className="text-sm font-medium text-brand-700 hover:underline">Insights</Link>}>
        Flags for review
      </CardTitle>
      {risks.length === 0 && declines.length === 0 ? (
        <p className="text-sm text-ink-500">No elevated risk or decline flags.</p>
      ) : (
        <ul className="space-y-3">
          {risks.slice(0, 3).map(({ resident, risk }) => (
            <li key={risk.id}>
              <Link href={`/service-user/${resident.id}`} className="block rounded-lg p-2 -m-2 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink-900">{fullName(resident)}</span>
                  <Chip tone={riskTone(risk.band)}>{humanize(risk.band)} risk</Chip>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">{risk.topFactors[0]?.explanation}</p>
              </Link>
            </li>
          ))}
          {declines.slice(0, 2).map(({ resident, snapshot }) => (
            <li key={snapshot.id}>
              <Link href={`/service-user/${resident.id}`} className="block rounded-lg p-2 -m-2 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink-900">{fullName(resident)}</span>
                  <Chip tone="danger">Decline</Chip>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">{DOMAIN_LABELS[snapshot.domain]} below own baseline</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-500">Synthetic data · flags inform a clinician; they never act.</p>
    </Card>
  );
}

export function ResidentLink({ resident }: { resident: Resident }) {
  return (
    <Link href={`/service-user/${resident.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-brand-700">
      <span className="truncate text-sm font-medium">{fullName(resident)}</span>
      <ResidentStatusChip status={resident.status} />
    </Link>
  );
}
