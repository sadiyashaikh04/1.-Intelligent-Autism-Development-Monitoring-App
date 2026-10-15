"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScheduleAssessmentDialog } from "@/components/clinical/schedule-assessment-dialog";
import { ResidentStatusChip } from "@/components/residents/status";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/overlay";
import { Card, CardTitle, Chip, EmptyState, PageHeader } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import type { AssessmentStatus, Resident } from "@/data/types";
import { listAssessments, listResidents, useQuery, useRequiredViewer, type AssessmentRow } from "@/lib/data-source";
import { DOMAIN_LABELS, assessmentTone, humanize } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { formatDateTime, fullName } from "@/lib/format";

type Group = "todo" | "review" | "done" | "all";
const GROUPS: Record<Group, AssessmentStatus[] | null> = {
  todo: ["SCHEDULED", "IN_PROGRESS", "REVISION_REQUESTED"],
  review: ["SUBMITTED"],
  done: ["APPROVED"],
  all: null,
};

const SCHEDULABLE = ["MDT_ASSIGNED", "ASSESSMENTS_SCHEDULED", "ASSESSMENTS_IN_PROGRESS"];

export default function AssessmentsPage() {
  const router = useRouter();
  const viewer = useRequiredViewer();
  const rows = useQuery(listAssessments);
  const residents = useQuery(listResidents, {});
  const [scheduling, setScheduling] = useState<Resident | null>(null);
  const defaultGroup: Group = viewer.role === "MDT_HEAD" ? "review" : viewer.role === "JR_PSYCHOLOGIST" ? "todo" : "all";
  const [group, setGroup] = useState<Group>(defaultGroup);

  const inGroup = (g: Group) => rows.filter((r) => !GROUPS[g] || GROUPS[g]!.includes(r.assessment.status));
  const visible = inGroup(group);
  const canSchedule = can(viewer.role, "assessment.schedule");
  const needing = residents.filter((r) => SCHEDULABLE.includes(r.status));

  const title =
    viewer.role === "MDT_HEAD" ? "Assessment reviews" : viewer.role === "JR_PSYCHOLOGIST" ? "My assessments" : "Assessments";

  return (
    <>
      <PageHeader
        title={title}
        subtitle="Descriptive rubrics of our own — not an implementation of any licensed instrument."
      />

      {canSchedule && (
        <Card className="mb-5">
          <CardTitle>Ready for assessment</CardTitle>
          {needing.length === 0 ? (
            <p className="text-sm text-ink-500">No service users are waiting for assessments.</p>
          ) : (
            <ul className="divide-y divide-line">
              {needing.map((r) => {
                const count = rows.filter((a) => a.assessment.residentId === r.id).length;
                return (
                  <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">
                        {r.firstName} {r.lastName} <span className="text-xs font-normal text-ink-500">{r.code}</span>
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                        <ResidentStatusChip status={r.status} />
                        <span>{count} scheduled so far</span>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setScheduling(r)}>
                      Schedule
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <Tabs<Group>
        active={group}
        onChange={setGroup}
        tabs={[
          { key: "todo", label: "To do", count: inGroup("todo").length },
          { key: "review", label: "Awaiting review", count: inGroup("review").length },
          { key: "done", label: "Approved", count: inGroup("done").length },
          { key: "all", label: "All", count: rows.length },
        ]}
      />
      <div className="mt-4">
        {visible.length === 0 ? (
          <EmptyState title="Nothing here" body="Assessments move between these lists as they are started, submitted and reviewed." />
        ) : (
          <DataTable<AssessmentRow>
            rows={visible}
            rowKey={(r) => r.assessment.id}
            onRowClick={(r) => router.push(`/assessment/${r.assessment.id}`)}
            mobileTitle={(r) => `${r.type?.name} — ${r.resident?.firstName} ${r.resident?.lastName}`}
            columns={[
              { header: "Assessment", cell: (r) => <span className="font-medium">{r.type?.name}</span>, desktopOnly: true },
              { header: "Service user", cell: (r) => fullName(r.resident), desktopOnly: true },
              { header: "Domain", cell: (r) => (r.type ? DOMAIN_LABELS[r.type.domain] : "—") },
              { header: "Clinician", cell: (r) => fullName(r.assignee) },
              { header: "Scheduled", cell: (r) => formatDateTime(r.assessment.scheduledAt) },
              { header: "Status", cell: (r) => <Chip tone={assessmentTone(r.assessment.status)}>{humanize(r.assessment.status)}</Chip>, wide: true },
            ]}
          />
        )}
      </div>

      {scheduling && <ScheduleAssessmentDialog resident={scheduling} onClose={() => setScheduling(null)} />}
    </>
  );
}
