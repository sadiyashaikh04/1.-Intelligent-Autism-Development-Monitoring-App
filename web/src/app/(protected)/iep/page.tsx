"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Chip, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import { listIepPlans, listResidents, useActions, useQuery, useRequiredViewer } from "@/lib/data-source";
import { goalApprovalTone, humanize, iepTone } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { formatDate, fullName } from "@/lib/format";

export default function IepPage() {
  const router = useRouter();
  const viewer = useRequiredViewer();
  const actions = useActions();
  const plans = useQuery(listIepPlans);
  const residents = useQuery(listResidents, {});
  const [error, setError] = useState<string | null>(null);

  const author = can(viewer.role, "iep.author");
  const reviewer = can(viewer.role, "iep.review");
  const activator = can(viewer.role, "iep.activate");

  const latestPlan = (residentId: string) =>
    plans.filter((p) => p.plan.residentId === residentId).sort((a, b) => b.plan.version - a.plan.version)[0];
  const readyForPlan = author
    ? residents.filter(
        (r) =>
          r.status === "ASSESSMENTS_COMPLETED" ||
          (r.status === "IEP_IN_PROGRESS" && latestPlan(r.id)?.plan.status === "REJECTED_IEP"),
      )
    : [];
  const pendingReview = plans.filter((p) => p.plan.status === "SUBMITTED_IEP");
  const toActivate = plans.filter((p) => p.plan.status === "APPROVED_IEP");

  function create(residentId: string) {
    const result = actions.createIepPlan({ residentId });
    if (result.ok && result.createdId) router.push(`/iep/${result.createdId}`);
    else setError(result.error ?? "Could not create the plan.");
  }

  const title = reviewer ? "Goal approvals" : author ? "IEP builder" : "IEP plans";

  return (
    <>
      <PageHeader title={title} subtitle="Individualised education plans and their goals." />
      {error && <div className="mb-4"><Notice tone="danger">{error}</Notice></div>}

      {author && readyForPlan.length > 0 && (
        <Card className="mb-5">
          <CardTitle>Ready for a plan</CardTitle>
          <ul className="divide-y divide-line">
            {readyForPlan.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-ink-900">
                  {r.firstName} {r.lastName}{" "}
                  <span className="text-xs font-normal text-ink-500">
                    {r.code} · {latestPlan(r.id) ? "previous plan was rejected" : "assessments completed"}
                  </span>
                </p>
                <Button size="sm" onClick={() => create(r.id)}>
                  Create plan v{(latestPlan(r.id)?.plan.version ?? 0) + 1}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reviewer && (
        <Card className="mb-5">
          <CardTitle>Waiting for your approval</CardTitle>
          {pendingReview.length === 0 ? (
            <p className="text-sm text-ink-500">No plans are waiting for goal approval.</p>
          ) : (
            <ul className="divide-y divide-line">
              {pendingReview.map(({ plan, resident, goals, author: by }) => (
                <li key={plan.id}>
                  <Link href={`/iep/${plan.id}`} className="flex flex-col gap-1 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-ink-900">
                      {fullName(resident)} · plan v{plan.version}
                    </span>
                    <span className="text-xs text-ink-500">
                      {goals.filter((g) => g.goal.approvalStatus === "PENDING_MDT_APPROVAL").length} goals pending · by {fullName(by)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {activator && toActivate.length > 0 && (
        <Card className="mb-5">
          <CardTitle>Approved — ready to activate</CardTitle>
          <ul className="divide-y divide-line">
            {toActivate.map(({ plan, resident }) => (
              <li key={plan.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-ink-900">{fullName(resident)} · plan v{plan.version}</span>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => {
                    const r = actions.activateIepPlan({ planId: plan.id });
                    if (!r.ok) setError(r.error ?? "Could not activate.");
                  }}
                >
                  Activate plan
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mb-3 text-base font-semibold text-ink-900">All plans</h2>
      {plans.length === 0 ? (
        <EmptyState title="No plans yet" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {plans.map(({ plan, resident, goals, author: by }) => (
            <li key={plan.id}>
              <Link href={`/iep/${plan.id}`} className="block rounded-xl bg-surface p-4 shadow-sm ring-1 ring-line hover:ring-brand-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{fullName(resident)}</p>
                    <p className="text-xs text-ink-500">
                      v{plan.version} · {fullName(by)} · {formatDate(plan.createdAt)}
                    </p>
                  </div>
                  <Chip tone={iepTone(plan.status)}>{humanize(plan.status)}</Chip>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {goals.map(({ goal }) => (
                    <Chip key={goal.id} tone={goalApprovalTone(goal.approvalStatus)}>
                      {goal.title.length > 28 ? `${goal.title.slice(0, 28)}…` : goal.title}
                    </Chip>
                  ))}
                  {goals.length === 0 && <span className="text-xs text-ink-500">No goals yet</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
