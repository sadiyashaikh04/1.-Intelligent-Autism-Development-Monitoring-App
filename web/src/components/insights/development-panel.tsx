"use client";

import { TrendSummary } from "@/components/residents/detail-tabs";
import { Card, CardTitle, EmptyState } from "@/components/ui/primitives";
import { getDevelopment, useQuery } from "@/lib/data-source";
import { formatDateTime } from "@/lib/format";

/** A resident's development trajectories. The chart is added with Insights. */
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
      <TrendSummary trends={trends} />
      <p className="mt-3 text-xs text-ink-500">
        Synthetic data · last computed {formatDateTime(trends[0]!.latest.computedAt)}
      </p>
    </Card>
  );
}
