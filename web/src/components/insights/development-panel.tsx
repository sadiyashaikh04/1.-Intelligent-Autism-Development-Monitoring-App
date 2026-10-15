"use client";

import { TrendSummary } from "@/components/residents/detail-tabs";
import { Card, CardTitle, EmptyState } from "@/components/ui/primitives";
import { getDevelopment, useQuery } from "@/lib/data-source";
import { formatDateTime } from "@/lib/format";
import { TrendChart } from "./trend-chart";

/** A resident's development trajectories (parent spec §6.1 A and B). */
export function DevelopmentPanel({ residentId }: { residentId: string }) {
  const trends = useQuery(getDevelopment, residentId);
  if (!trends || trends.length === 0) {
    return (
      <EmptyState
        title="No development data yet"
        body="Trajectories appear after a few weeks of goal and activity logs on an active plan."
      />
    );
  }
  return (
    <Card>
      <CardTitle>Development trajectory</CardTitle>
      <TrendChart trends={trends} />
      <div className="mt-4">
        <TrendSummary trends={trends} />
      </div>
      <p className="mt-3 text-xs text-ink-500">
        Synthetic data · last computed {formatDateTime(trends[0]!.latest.computedAt)} · the model only flags; a clinician decides.
      </p>
    </Card>
  );
}
