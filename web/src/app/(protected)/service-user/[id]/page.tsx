"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DevelopmentPanel } from "@/components/insights/development-panel";
import { AdvanceStatusDialog } from "@/components/residents/advance-status-dialog";
import {
  AdlTab,
  AssessmentsTab,
  CareTeamTab,
  HistoryTab,
  IepTab,
  OverviewTab,
} from "@/components/residents/detail-tabs";
import { GoalProgressButton } from "@/components/logging/goal-progress-dialog";
import { ResidentStatusChip } from "@/components/residents/status";
import { Button, buttonClasses } from "@/components/ui/button";
import { Tabs } from "@/components/ui/overlay";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { getResidentDetail, useQuery, useRequiredViewer } from "@/lib/data-source";
import { humanize } from "@/lib/domain/labels";
import { can, detailTabsFor, navFor, type DetailTab } from "@/lib/domain/permissions";
import { manualNextStatuses } from "@/lib/domain/transitions";
import { ageFrom, initials } from "@/lib/format";

const TAB_LABELS: Record<DetailTab, string> = {
  overview: "Overview",
  history: "History",
  "care-team": "Care team",
  assessments: "Assessments",
  iep: "IEP",
  adl: "ADL",
  development: "Development",
};

export default function ServiceUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const viewer = useRequiredViewer();
  const detail = useQuery(getResidentDetail, id);
  const tabs = detailTabsFor(viewer.role);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [advancing, setAdvancing] = useState(false);

  if (!detail) {
    return (
      <EmptyState
        title="Service user not found"
        body="They may not exist, or they are not assigned to you."
        action={
          <Link href="/service-user" className={buttonClasses("secondary")}>
            Back to the list
          </Link>
        }
      />
    );
  }

  const r = detail.resident;
  const canAdvance = can(viewer.role, "resident.advance") && manualNextStatuses(r.status).length > 0;
  const hasAssessmentPages = navFor(viewer.role).some((n) => n.key === "assessment");

  return (
    <>
      <Link href="/service-user" className="mb-3 inline-flex min-h-11 items-center text-sm text-ink-500 hover:text-ink-900">
        ← Service users
      </Link>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={initials(r)} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-ink-900 sm:text-2xl">
              {r.firstName} {r.lastName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-500">
              <span className="font-mono text-xs">{r.code}</span>
              <span>·</span>
              <span>Age {ageFrom(r.dateOfBirth)}</span>
              <span>·</span>
              <span>{humanize(r.programType)}</span>
              <ResidentStatusChip status={r.status} />
            </div>
          </div>
        </div>
        {canAdvance && <Button onClick={() => setAdvancing(true)}>Advance status</Button>}
      </div>

      <Tabs
        tabs={tabs.map((key) => ({ key, label: TAB_LABELS[key] }))}
        active={tab}
        onChange={setTab}
      />
      <div className="mt-4">
        {tab === "overview" && <OverviewTab detail={detail} />}
        {tab === "history" && <HistoryTab detail={detail} />}
        {tab === "care-team" && <CareTeamTab detail={detail} />}
        {tab === "assessments" && <AssessmentsTab detail={detail} linkable={hasAssessmentPages} />}
        {tab === "iep" && (
          <IepTab
            detail={detail}
            goalAction={
              can(viewer.role, "goal.log") ? (goalId) => <GoalProgressButton goalId={goalId} /> : undefined
            }
          />
        )}
        {tab === "adl" && <AdlTab detail={detail} />}
        {tab === "development" && <DevelopmentPanel residentId={r.id} />}
      </div>

      {advancing && <AdvanceStatusDialog resident={r} open onClose={() => setAdvancing(false)} />}
    </>
  );
}
