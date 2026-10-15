"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import { CHART_COLORS } from "@/config/theme";
import type { ClinicalDomain } from "@/data/types";
import type { DomainTrend } from "@/lib/data-source";
import { DOMAIN_LABELS } from "@/lib/domain/labels";
import { formatDate } from "@/lib/format";

/**
 * Independence index (0–1) per domain over the weekly snapshots. Colour is
 * fixed by domain — never by rank — so a domain keeps its colour across
 * residents. Identity is never colour-alone: legend + end labels + table.
 */
const DOMAIN_ORDER: ClinicalDomain[] = ["PSYCHOLOGY", "SPEECH_THERAPY", "OCCUPATIONAL_THERAPY", "SPECIAL_EDUCATION"];
const colorOf = (d: ClinicalDomain) => CHART_COLORS[DOMAIN_ORDER.indexOf(d)]!;
const shortDate = (iso: string) => formatDate(iso).replace(/ \d{4}$/, "");
const SHORT: Record<ClinicalDomain, string> = {
  PSYCHOLOGY: "Psych",
  SPEECH_THERAPY: "Speech",
  OCCUPATIONAL_THERAPY: "OT",
  SPECIAL_EDUCATION: "Special ed",
};

const PLOT_PX = 220; // approx. plot height for 0..1, used to space end labels
const MIN_GAP = 13 / PLOT_PX;

/** Nudges end-label positions apart so converging lines never stack labels. */
function spreadLabels(values: Array<[ClinicalDomain, number]>): Map<ClinicalDomain, number> {
  const sorted = [...values].sort((a, b) => a[1] - b[1]);
  const placed: Array<[ClinicalDomain, number]> = [];
  for (const [d, v] of sorted) {
    const prev = placed[placed.length - 1];
    placed.push([d, prev && v - prev[1] < MIN_GAP ? prev[1] + MIN_GAP : v]);
  }
  return new Map(placed.map(([d, y], i) => [d, (y - sorted[i]![1]) * PLOT_PX]));
}

/** Direct label at the line's last point, in text ink (never series colour). */
function endLabel(domain: ClinicalDomain, lastIndex: number, nudgePx: number) {
  function EndLabel(props: { x?: number | string; y?: number | string; index?: number }) {
    if (props.index !== lastIndex || props.x === undefined || props.y === undefined) return null;
    return (
      <text x={Number(props.x) + 8} y={Number(props.y) - nudgePx} dy={4} fontSize={11} fill="var(--color-ink-700)">
        {SHORT[domain]}
      </text>
    );
  }
  return EndLabel;
}

type Row = { week: string } & Partial<Record<ClinicalDomain, number>>;

function ChartTooltip({ active, payload, label }: TooltipContentProps<TooltipValueType, string | number>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs shadow-lg ring-1 ring-line">
      <p className="mb-1 font-medium text-ink-900">Week of {shortDate(String(label))}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink-700">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {DOMAIN_LABELS[p.dataKey as ClinicalDomain]}
          <span className="ml-auto pl-3 font-medium tabular-nums text-ink-900">{Number(p.value).toFixed(2)}</span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ trends }: { trends: DomainTrend[] }) {
  const [asTable, setAsTable] = useState(false);
  const domains = DOMAIN_ORDER.filter((d) => trends.some((t) => t.domain === d));
  const weeks = [...new Set(trends.flatMap((t) => t.points.map((p) => p.weekStart)))].sort();
  const rows: Row[] = weeks.map((week) => {
    const row: Row = { week };
    for (const t of trends) {
      const point = t.points.find((p) => p.weekStart === week);
      if (point) row[t.domain] = point.independenceIndex;
    }
    return row;
  });

  const lastValues = domains.map((d) => {
    const last = [...rows].reverse().find((r) => r[d] !== undefined);
    return [d, last?.[d] ?? 0] as [ClinicalDomain, number];
  });
  const nudges = spreadLabels(lastValues);

  return (
    <figure>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700" aria-label="Legend">
          {domains.map((d) => (
            <li key={d} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: colorOf(d) }} />
              {DOMAIN_LABELS[d]}
            </li>
          ))}
        </ul>
        <button onClick={() => setAsTable((v) => !v)} className="min-h-9 text-xs font-medium text-brand-700 hover:underline">
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-ink-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Week of</th>
                {domains.map((d) => <th key={d} className="py-1.5 pr-3 font-medium">{DOMAIN_LABELS[d]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums text-ink-900">
              {rows.map((r) => (
                <tr key={r.week}>
                  <td className="py-1.5 pr-3">{shortDate(r.week)}</td>
                  {domains.map((d) => <td key={d} className="py-1.5 pr-3">{r[d]?.toFixed(2) ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 64, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--color-line)" />
              <XAxis
                dataKey="week"
                tickFormatter={shortDate}
                tick={{ fontSize: 11, fill: "var(--color-ink-500)" }}
                axisLine={{ stroke: "var(--color-line)" }}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tick={{ fontSize: 11, fill: "var(--color-ink-500)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={ChartTooltip} cursor={{ stroke: "var(--color-ink-400)", strokeDasharray: "3 3" }} />
              {domains.map((d) => (
                <Line
                  key={d}
                  type="monotone"
                  dataKey={d}
                  stroke={colorOf(d)}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2, stroke: "#fff", fill: colorOf(d) }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                  isAnimationActive={false}
                  connectNulls
                  label={endLabel(d, rows.map((r) => r[d] !== undefined).lastIndexOf(true), nudges.get(d) ?? 0)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <figcaption className="mt-1 text-xs text-ink-500">
        Independence index, 0 = full support · 1 = fully independent. Synthetic data.
      </figcaption>
    </figure>
  );
}
