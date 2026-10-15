"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Chip, EmptyState, KeyValue, Card, CardTitle, Avatar, Bar } from "@/components/ui/primitives";
import type { DomainTrend, ResidentDetail } from "@/lib/data-source";
import {
  DOMAIN_LABELS,
  RESIDENT_STATUS_LABELS,
  ROLE_LABELS,
  adlApprovalTone,
  assessmentTone,
  goalApprovalTone,
  goalStatusTone,
  humanize,
  iepTone,
  trajectoryTone,
} from "@/lib/domain/labels";
import { ageFrom, formatDate, formatDateTime, fullName, initials, percent } from "@/lib/format";
import { JourneyStrip } from "./status";

export function OverviewTab({ detail }: { detail: ResidentDetail }) {
  const r = detail.resident;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardTitle>Profile</CardTitle>
        <KeyValue
          items={[
            ["Code", <span key="c" className="font-mono">{r.code}</span>],
            ["Date of birth", `${formatDate(r.dateOfBirth)} (age ${ageFrom(r.dateOfBirth)})`],
            ["Gender", humanize(r.gender)],
            ["Programme", humanize(r.programType)],
            ["Admitted", formatDate(r.admissionDate)],
            ["Record created", formatDate(r.createdAt)],
          ]}
        />
      </Card>
      <Card>
        <CardTitle>Care journey</CardTitle>
        <JourneyStrip status={r.status} />
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-500">Care team</dt>
            <dd className="font-medium">{detail.careTeam.length} staff</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Assessments</dt>
            <dd className="font-medium">{detail.assessments.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">IEP plans</dt>
            <dd className="font-medium">{detail.plans.length}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

export function HistoryTab({ detail }: { detail: ResidentDetail }) {
  if (detail.statusHistory.length === 0) return <EmptyState title="No status changes yet" />;
  return (
    <Card>
      <ol className="relative space-y-5 border-l border-line pl-5">
        {detail.statusHistory.map(({ entry, changedBy }) => (
          <li key={entry.id} className="relative">
            <span className="absolute -left-[26px] top-1 size-3 rounded-full bg-brand-500 ring-4 ring-brand-50" />
            <p className="text-sm font-medium text-ink-900">
              {entry.fromStatus ? `${RESIDENT_STATUS_LABELS[entry.fromStatus]} → ` : "Created as "}
              {RESIDENT_STATUS_LABELS[entry.toStatus]}
            </p>
            <p className="text-xs text-ink-500">
              {formatDateTime(entry.createdAt)} · {fullName(changedBy)}
            </p>
            {entry.reason && <p className="mt-1 text-sm text-ink-700">{entry.reason}</p>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function PersonRow({ name, sub, extra }: { name: string; sub: string; extra?: ReactNode }) {
  const [first = "", last = ""] = name.split(" ");
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar name={initials({ firstName: first, lastName: last })} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{name}</p>
        <p className="truncate text-xs text-ink-500">{sub}</p>
      </div>
      {extra}
    </li>
  );
}

export function CareTeamTab({ detail }: { detail: ResidentDetail }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>Care team</CardTitle>
        {detail.careTeam.length === 0 ? (
          <p className="text-sm text-ink-500">No staff assigned yet. A CSC assigns the team after enrolment.</p>
        ) : (
          <ul className="divide-y divide-line">
            {detail.careTeam.map(({ assignment, user }) => (
              <PersonRow
                key={assignment.id}
                name={fullName(user)}
                sub={`${ROLE_LABELS[assignment.role]} · ${user?.email ?? ""}`}
                extra={<span className="hidden text-xs text-ink-500 sm:inline">since {formatDate(assignment.assignedAt)}</span>}
              />
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle>Family</CardTitle>
        {detail.parents.length === 0 ? (
          <p className="text-sm text-ink-500">No parent or guardian linked.</p>
        ) : (
          <ul className="divide-y divide-line">
            {detail.parents.map(({ link, parent }) => (
              <PersonRow key={link.id} name={fullName(parent)} sub={`${link.relationship} · ${parent?.email ?? ""}`} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function AssessmentsTab({ detail, linkable }: { detail: ResidentDetail; linkable: boolean }) {
  if (detail.assessments.length === 0) {
    return (
      <EmptyState
        title="No assessments yet"
        body="A CSC schedules baseline assessments once the care team is assigned."
      />
    );
  }
  return (
    <Card padded={false}>
      <ul className="divide-y divide-line">
        {detail.assessments.map(({ assessment, type, assignee }) => {
          const body = (
            <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{type?.name}</p>
                <p className="text-xs text-ink-500">
                  {type && DOMAIN_LABELS[type.domain]} · {fullName(assignee)} · {formatDateTime(assessment.scheduledAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {assessment.score !== null && (
                  <span className="text-sm tabular-nums text-ink-700">Score {assessment.score}</span>
                )}
                <Chip tone={assessmentTone(assessment.status)}>{humanize(assessment.status)}</Chip>
              </div>
            </div>
          );
          return (
            <li key={assessment.id}>
              {linkable ? (
                <Link href={`/assessment/${assessment.id}`} className="block hover:bg-slate-50">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Share of a goal's recent sessions that were achieved (partial = half). */
export function goalRate(progress: ResidentDetail["plans"][number]["goals"][number]["progress"]): number | null {
  const recent = progress.slice(0, 12);
  if (recent.length === 0) return null;
  const score = recent.reduce(
    (s, p) => s + (p.outcome === "ACHIEVED_LOG" ? 1 : p.outcome === "PARTIALLY_ACHIEVED_LOG" ? 0.5 : 0),
    0,
  );
  return score / recent.length;
}

export function IepTab({
  detail,
  goalAction,
}: {
  detail: ResidentDetail;
  goalAction?: (goalId: string) => ReactNode;
}) {
  if (detail.plans.length === 0) {
    return <EmptyState title="No IEP plan yet" body="A psychologist drafts the plan once assessments are completed." />;
  }
  return (
    <div className="space-y-4">
      {detail.plans.map(({ plan, author, goals }) => (
        <Card key={plan.id}>
          <CardTitle action={<Chip tone={iepTone(plan.status)}>{humanize(plan.status)}</Chip>}>
            IEP plan v{plan.version}
          </CardTitle>
          <p className="-mt-2 mb-3 text-xs text-ink-500">
            Authored by {fullName(author)}
            {plan.startDate && ` · ${formatDate(plan.startDate)} – ${formatDate(plan.endDate)}`}
          </p>
          <ul className="divide-y divide-line">
            {goals.map(({ goal, progress }) => {
              const rate = goalRate(progress);
              return (
                <li key={goal.id} className="py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">{goal.title}</p>
                      <p className="text-sm text-ink-500">{goal.description}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        {DOMAIN_LABELS[goal.domain]} · {humanize(goal.frequency)} · target {goal.targetCount} ·{" "}
                        {goal.assignedRole === "PSS" ? "practised by PSS" : "led by clinician"}
                      </p>
                      {goal.rejectionReason && (
                        <p className="mt-1 text-xs text-rose-700">Rejected: {goal.rejectionReason}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Chip tone={goalApprovalTone(goal.approvalStatus)}>{humanize(goal.approvalStatus)}</Chip>
                      <Chip tone={goalStatusTone(goal.status)}>{humanize(goal.status)}</Chip>
                    </div>
                  </div>
                  {rate !== null && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="w-full max-w-xs">
                        <Bar value={rate} tone={rate >= 0.6 ? "success" : rate >= 0.35 ? "warning" : "danger"} />
                      </div>
                      <span className="whitespace-nowrap text-xs text-ink-500">
                        {percent(rate)} of last {Math.min(progress.length, 12)} sessions
                      </span>
                    </div>
                  )}
                  {goalAction && <div className="mt-2">{goalAction(goal.id)}</div>}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export function AdlTab({ detail }: { detail: ResidentDetail }) {
  if (detail.recentAdl.length === 0) {
    return <EmptyState title="No daily activity logs yet" body="Logs appear once ADL activities are assigned and the plan is active." />;
  }
  return (
    <Card padded={false}>
      <ul className="divide-y divide-line">
        {detail.recentAdl.map(({ log, activity, loggedBy }) => (
          <li key={log.id} className="flex flex-col gap-1.5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-ink-900">{activity?.name}</p>
              <p className="text-xs text-ink-500">
                {formatDate(log.logDate)} · {humanize(log.shift)} · {fullName(loggedBy)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-ink-700">{humanize(log.status)}</span>
              {log.promptLevel && <span className="text-ink-500">· {humanize(log.promptLevel)}</span>}
              {log.mood && <span className="text-ink-500">· {humanize(log.mood)}</span>}
              <Chip tone={adlApprovalTone(log.approvalStatus)}>{humanize(log.approvalStatus)}</Chip>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TrendSummary({ trends }: { trends: DomainTrend[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {trends.map((t) => (
        <li key={t.domain} className="rounded-lg p-3 ring-1 ring-inset ring-line">
          <p className="text-sm font-medium text-ink-900">{DOMAIN_LABELS[t.domain]}</p>
          <div className="mt-1 flex items-center gap-2">
            <Chip tone={trajectoryTone(t.latest.trajectory)}>{humanize(t.latest.trajectory)}</Chip>
            <span className="text-xs tabular-nums text-ink-500">index {t.latest.independenceIndex.toFixed(2)}</span>
          </div>
          {(t.latest.baselineDeviation ?? 0) <= -2 && (
            <p className="mt-1 text-xs font-medium text-rose-700">Below own baseline (z = {t.latest.baselineDeviation})</p>
          )}
        </li>
      ))}
    </ul>
  );
}
