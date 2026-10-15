"use client";

import Link from "next/link";
import {
  FlagsCard,
  ResidentLink,
  ResidentsByStatus,
  StatCard,
  StatGrid,
  TodaySlots,
} from "@/components/dashboard/widgets";
import { ButtonLink } from "@/components/ui/button";
import { Bar, Card, CardTitle, Chip, PageHeader } from "@/components/ui/primitives";
import {
  listAdlAssignments,
  listAdlLogs,
  listAssessments,
  listIepPlans,
  listIncidents,
  listResidents,
  listRiskBoard,
  listUsers,
  useQuery,
  useRequiredViewer,
} from "@/lib/data-source";
import { ROLE_LABELS, adlApprovalTone, humanize } from "@/lib/domain/labels";
import type { UserRole } from "@/data/types";
import { currentShift, formatDate, fullName, localIsoDate } from "@/lib/format";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const viewer = useRequiredViewer();
  const subtitle = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <>
      <PageHeader title={`${greeting()}, ${viewer.firstName}`} subtitle={`${subtitle} · ${ROLE_LABELS[viewer.role]}`} />
      {viewer.role === "SUPER_ADMIN" && <AdminDashboard />}
      {viewer.role === "CSC" && <CscDashboard />}
      {viewer.role === "JR_PSYCHOLOGIST" && <PsychDashboard />}
      {viewer.role === "MDT_HEAD" && <MdtDashboard />}
      {viewer.role === "PSS" && <PssToday />}
    </>
  );
}

const open = (status: string) => !["RESOLVED", "CLOSED"].includes(status);

function AdminDashboard() {
  const residents = useQuery(listResidents, {});
  const users = useQuery((db) => listUsers(db));
  const incidents = useQuery(listIncidents);
  const roles: UserRole[] = ["SUPER_ADMIN", "CSC", "JR_PSYCHOLOGIST", "MDT_HEAD", "PSS", "PARENT"];
  return (
    <>
      <StatGrid>
        <StatCard label="Active users" value={users.filter((u) => u.isActive).length} href="/user-management" />
        <StatCard label="Service users" value={residents.length} href="/service-user" tone="info" />
        <StatCard label="Open incidents" value={incidents.filter((i) => open(i.incident.status)).length} href="/incidents" tone="warning" />
        <StatCard label="Escalated" value={incidents.filter((i) => i.incident.status === "ESCALATED").length} href="/incidents" tone="danger" />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <ResidentsByStatus residents={residents} />
        <Card>
          <CardTitle action={<Link href="/user-management" className="text-sm font-medium text-brand-700 hover:underline">Manage</Link>}>
            Users by role
          </CardTitle>
          <ul className="divide-y divide-line">
            {roles.map((role) => (
              <li key={role} className="flex justify-between py-2 text-sm">
                <span className="text-ink-700">{ROLE_LABELS[role]}</span>
                <span className="tabular-nums font-medium">{users.filter((u) => u.role === role).length}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function CscDashboard() {
  const residents = useQuery(listResidents, {});
  const pendingAdl = useQuery(listAdlLogs, { approvalStatus: "SUBMITTED" });
  const plans = useQuery(listIepPlans);
  const incidents = useQuery(listIncidents);
  const toAssess = residents.filter((r) => r.status === "MDT_ASSIGNED");
  const intake = residents.filter((r) => ["IMPORTED", "ENROLLED", "CSC_ASSIGNED"].includes(r.status));
  return (
    <>
      <StatGrid>
        <StatCard label="ADL logs to approve" value={pendingAdl.length} href="/adl-tracking" tone="warning" />
        <StatCard label="Ready for assessment" value={toAssess.length} href="/assessment" tone="info" />
        <StatCard label="Plans to activate" value={plans.filter((p) => p.plan.status === "APPROVED_IEP").length} href="/iep" tone="success" />
        <StatCard label="Open incidents" value={incidents.filter((i) => open(i.incident.status)).length} href="/incidents" tone="danger" />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ResidentsByStatus residents={residents} />
        </div>
        <Card>
          <CardTitle>Intake to progress</CardTitle>
          {intake.length === 0 ? (
            <p className="text-sm text-ink-500">No one waiting at intake.</p>
          ) : (
            <ul className="divide-y divide-line">{intake.map((r) => <li key={r.id}><ResidentLink resident={r} /></li>)}</ul>
          )}
        </Card>
        <FlagsCard />
        <div className="lg:col-span-2">
          <TodaySlots />
        </div>
      </div>
    </>
  );
}

function PsychDashboard() {
  const assessments = useQuery(listAssessments);
  const plans = useQuery(listIepPlans);
  const residents = useQuery(listResidents, {});
  const todo = assessments.filter((a) => ["SCHEDULED", "IN_PROGRESS", "REVISION_REQUESTED"].includes(a.assessment.status));
  return (
    <>
      <StatGrid>
        <StatCard label="Assessments to do" value={todo.length} href="/assessment" tone="brand" />
        <StatCard label="Awaiting MDT review" value={assessments.filter((a) => a.assessment.status === "SUBMITTED").length} href="/assessment" tone="warning" />
        <StatCard label="Draft plans" value={plans.filter((p) => p.plan.status === "DRAFT_IEP").length} href="/iep" tone="info" />
        <StatCard label="My service users" value={residents.length} href="/service-user" tone="success" />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Next up</CardTitle>
          {todo.length === 0 ? (
            <p className="text-sm text-ink-500">No assessments waiting for you.</p>
          ) : (
            <ul className="divide-y divide-line">
              {todo.map(({ assessment, type, resident }) => (
                <li key={assessment.id}>
                  <Link href={`/assessment/${assessment.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-brand-700">
                    <span className="min-w-0 truncate text-sm">
                      <span className="font-medium">{type?.name}</span> · {fullName(resident)}
                    </span>
                    <Chip tone={assessment.status === "REVISION_REQUESTED" ? "danger" : "info"}>{humanize(assessment.status)}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <TodaySlots title="My sessions today" />
        <FlagsCard />
      </div>
    </>
  );
}

function MdtDashboard() {
  const assessments = useQuery(listAssessments);
  const plans = useQuery(listIepPlans);
  const incidents = useQuery(listIncidents);
  const risks = useQuery(listRiskBoard);
  const pendingGoals = plans.flatMap((p) => p.goals).filter((g) => g.goal.approvalStatus === "PENDING_MDT_APPROVAL");
  const awaiting = assessments.filter((a) => a.assessment.status === "SUBMITTED");
  return (
    <>
      <StatGrid>
        <StatCard label="Assessments to review" value={awaiting.length} href="/assessment" tone="warning" />
        <StatCard label="Goals to approve" value={pendingGoals.length} href="/iep" tone="brand" />
        <StatCard label="Incidents to review" value={incidents.filter((i) => ["REPORTED", "UNDER_REVIEW", "ESCALATED"].includes(i.incident.status)).length} href="/incidents" tone="danger" />
        <StatCard label="High risk" value={risks.filter((r) => r.risk.band === "HIGH").length} href="/insights" tone="danger" hint="Synthetic data" />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Waiting for your decision</CardTitle>
          <ul className="divide-y divide-line text-sm">
            {awaiting.map(({ assessment, type, resident }) => (
              <li key={assessment.id}>
                <Link href={`/assessment/${assessment.id}`} className="flex justify-between gap-2 py-2 hover:text-brand-700">
                  <span className="truncate">{type?.name} · {fullName(resident)}</span>
                  <span className="text-xs text-ink-500">assessment</span>
                </Link>
              </li>
            ))}
            {plans.filter((p) => p.plan.status === "SUBMITTED_IEP").map(({ plan, resident }) => (
              <li key={plan.id}>
                <Link href={`/iep/${plan.id}`} className="flex justify-between gap-2 py-2 hover:text-brand-700">
                  <span className="truncate">IEP v{plan.version} · {fullName(resident)}</span>
                  <span className="text-xs text-ink-500">goals</span>
                </Link>
              </li>
            ))}
            {awaiting.length === 0 && !plans.some((p) => p.plan.status === "SUBMITTED_IEP") && (
              <li className="py-2 text-ink-500">Nothing is waiting for you.</li>
            )}
          </ul>
        </Card>
        <FlagsCard />
      </div>
    </>
  );
}

function PssToday() {
  const residents = useQuery(listResidents, { status: "ACTIVE" });
  const assignments = useQuery(listAdlAssignments);
  const today = localIsoDate();
  const shift = currentShift();
  const logsToday = useQuery(listAdlLogs, { logDate: today });
  const returned = useQuery(listAdlLogs, { approvalStatus: "REJECTED" });

  return (
    <>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <ButtonLink href="/adl-tracking" size="lg" className="sm:w-auto">Log activities</ButtonLink>
        <ButtonLink href="/incidents/new" size="lg" variant="secondary" className="sm:w-auto">Report incident</ButtonLink>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>{humanize(shift)} shift progress</CardTitle>
          <ul className="space-y-3">
            {residents.map((r) => {
              const mine = assignments.filter((a) => a.assignment.residentId === r.id);
              const done = mine.filter((a) => logsToday.some((l) => l.log.adlAssignmentId === a.assignment.id && l.log.shift === shift)).length;
              return (
                <li key={r.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <Link href={`/service-user/${r.id}`} className="font-medium text-ink-900 hover:text-brand-700">{fullName(r)}</Link>
                    <span className="tabular-nums text-ink-500">{done}/{mine.length} logged</span>
                  </div>
                  <Bar value={mine.length ? done / mine.length : 0} tone={done === mine.length && mine.length > 0 ? "success" : "brand"} />
                </li>
              );
            })}
            {residents.length === 0 && <li className="text-sm text-ink-500">No active service users assigned.</li>}
          </ul>
        </Card>
        <TodaySlots title="My activities today" />
        {returned.length > 0 && (
          <Card>
            <CardTitle>Returned logs</CardTitle>
            <ul className="divide-y divide-line text-sm">
              {returned.slice(0, 5).map(({ log, activity, resident }) => (
                <li key={log.id} className="py-2">
                  <div className="flex justify-between gap-2">
                    <span>{activity?.name} · {resident?.firstName}</span>
                    <Chip tone={adlApprovalTone(log.approvalStatus)}>{formatDate(log.logDate)}</Chip>
                  </div>
                  <p className="text-xs text-rose-700">{log.rejectionReason}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
