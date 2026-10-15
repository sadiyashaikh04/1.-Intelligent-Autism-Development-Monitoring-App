"use client";

import Link from "next/link";
import { useState } from "react";
import { StatCard, StatGrid } from "@/components/dashboard/widgets";
import { TrendChart } from "@/components/insights/trend-chart";
import { TrendSummary } from "@/components/residents/detail-tabs";
import { Field, Select } from "@/components/ui/form";
import { Card, CardTitle, Chip, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import {
  getDevelopment,
  listDeclineFlags,
  listResidents,
  listRiskBoard,
  useQuery,
  useRequiredViewer,
} from "@/lib/data-source";
import { DOMAIN_LABELS, humanize, riskTone } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { formatDateTime, fullName } from "@/lib/format";

export default function InsightsPage() {
  const viewer = useRequiredViewer();
  const risks = useQuery(listRiskBoard);
  const declines = useQuery(listDeclineFlags);
  const active = useQuery(listResidents, { status: "ACTIVE" });
  const [selected, setSelected] = useState(risks[0]?.resident.id ?? active[0]?.id ?? "");
  const trends = useQuery(getDevelopment, selected);
  const latest = useQuery((db, v) =>
    active.flatMap((r) => (getDevelopment(db, v, r.id) ?? []).map((t) => t.latest.trajectory)),
  );
  const showRisk = can(viewer.role, "insights.risk");

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle="Development trajectories, early-decline flags and incident risk for active service users."
      />
      <div className="mb-5">
        <Notice tone="warning">
          <strong>Synthetic data.</strong> These outputs come from generated sample records. The model only
          surfaces flags for a clinician — it never changes a plan, a status or a schedule, and never contacts a
          parent. Scores say nothing about real people.
        </Notice>
      </div>

      <StatGrid>
        <StatCard label="Domains improving" value={latest.filter((t) => t === "IMPROVING").length} tone="success" />
        <StatCard label="Domains stable" value={latest.filter((t) => t === "STABLE").length} tone="info" />
        <StatCard label="Decline flags" value={declines.length} tone="danger" hint="Below the person's own baseline" />
        <StatCard
          label="High risk (7 days)"
          value={showRisk ? risks.filter((r) => r.risk.band === "HIGH").length : "—"}
          tone="danger"
        />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardTitle>Development trajectory</CardTitle>
          <div className="mb-4 max-w-sm">
            <Field label="Service user" htmlFor="ins-resident">
              <Select id="ins-resident" value={selected} onChange={(e) => setSelected(e.target.value)}>
                {active.map((r) => (
                  <option key={r.id} value={r.id}>
                    {fullName(r)} · {r.code}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {trends && trends.length > 0 ? (
            <>
              <TrendChart trends={trends} />
              <div className="mt-4">
                <TrendSummary trends={trends} />
              </div>
              <p className="mt-3 text-xs text-ink-500">Last computed {formatDateTime(trends[0]!.latest.computedAt)} by the nightly job.</p>
            </>
          ) : (
            <EmptyState title="No trajectory yet" />
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardTitle>Early-decline flags</CardTitle>
          {declines.length === 0 ? (
            <p className="text-sm text-ink-500">No one is below their own baseline.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...new Map(declines.map((f) => [f.resident.id, f.resident])).values()].map((resident) => (
                <li key={resident.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setSelected(resident.id)} className="min-h-9 text-left font-medium text-ink-900 hover:text-brand-700">
                      {fullName(resident)}
                    </button>
                    <Chip tone="danger">Declining</Chip>
                  </div>
                  <ul className="mt-0.5 space-y-0.5 text-sm text-ink-500">
                    {declines
                      .filter((f) => f.resident.id === resident.id)
                      .map(({ snapshot }) => (
                        <li key={snapshot.id}>
                          {DOMAIN_LABELS[snapshot.domain]}: independence {snapshot.independenceIndex.toFixed(2)}
                          {snapshot.baselineDeviation !== null &&
                            `, ${Math.abs(snapshot.baselineDeviation).toFixed(1)} SD below own baseline`}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {showRisk && (
        <Card className="mt-4" padded={false}>
          <div className="border-b border-line p-4">
            <h2 className="font-semibold text-ink-900">Incident risk board · next 7 days</h2>
            <p className="text-xs text-ink-500">Sorted by score. Every flag shows why — a clinician reviews and decides.</p>
          </div>
          <ul className="divide-y divide-line">
            {risks.map(({ resident, risk }) => (
              <li key={risk.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-start">
                <div className="flex min-w-0 items-center justify-between gap-3 md:w-64 md:shrink-0 md:flex-col md:items-start">
                  <Link href={`/service-user/${resident.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                    {fullName(resident)}
                  </Link>
                  <span className="flex items-center gap-2">
                    <Chip tone={riskTone(risk.band)} dot>{humanize(risk.band)}</Chip>
                    <span className="text-xs tabular-nums text-ink-500">score {risk.score.toFixed(2)}</span>
                  </span>
                </div>
                <ul className="flex-1 space-y-1 text-sm text-ink-700">
                  {risk.topFactors.map((f) => (
                    <li key={f.feature} className="flex gap-2">
                      <span className={f.direction === "UP" ? "text-rose-600" : "text-emerald-600"} aria-hidden>
                        {f.direction === "UP" ? "▲" : "▼"}
                      </span>
                      <span>
                        {f.explanation}
                        <span className="sr-only">{f.direction === "UP" ? " (raises risk)" : " (lowers risk)"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="border-t border-line p-4 text-xs text-ink-500">
            Model {risks[0]?.risk.modelVersion} · evaluated on synthetic data only (temporal split). See the project report&apos;s
            limitations section.
          </p>
        </Card>
      )}
    </>
  );
}
