"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { Chip, EmptyState, PageHeader } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import type { IncidentStatus } from "@/data/types";
import { listIncidents, useQuery, useRequiredViewer, type IncidentRow } from "@/lib/data-source";
import { humanize, incidentTone, severityTone } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { formatDateTime, fullName } from "@/lib/format";

const STATUSES: IncidentStatus[] = ["REPORTED", "UNDER_REVIEW", "ESCALATED", "RESOLVED", "CLOSED"];

export default function IncidentsPage() {
  const router = useRouter();
  const viewer = useRequiredViewer();
  const all = useQuery(listIncidents);
  const [status, setStatus] = useState<IncidentStatus | "">(viewer.role === "MDT_HEAD" ? "" : "");
  const rows = all.filter((r) => !status || r.incident.status === status);
  const open = all.filter((r) => !["RESOLVED", "CLOSED"].includes(r.incident.status)).length;

  return (
    <>
      <PageHeader
        title={viewer.role === "MDT_HEAD" ? "Incident review" : "Incidents"}
        subtitle={`${open} open · ${all.length} in total`}
        actions={
          can(viewer.role, "incident.report") ? <ButtonLink href="/incidents/new">Report incident</ButtonLink> : undefined
        }
      />
      <div className="mb-4 max-w-xs">
        <Field label="Status" htmlFor="inc-status">
          <Select id="inc-status" value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus | "")}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No incidents" body={status ? "None with this status." : "Nothing has been reported."} />
      ) : (
        <DataTable<IncidentRow>
          rows={rows}
          rowKey={(r) => r.incident.id}
          onRowClick={(r) => router.push(`/incidents/${r.incident.id}`)}
          mobileTitle={(r) => `${humanize(r.incident.type)} — ${r.resident?.firstName} ${r.resident?.lastName}`}
          columns={[
            { header: "Type", cell: (r) => <span className="font-medium">{humanize(r.incident.type)}</span>, desktopOnly: true },
            { header: "Service user", cell: (r) => fullName(r.resident), desktopOnly: true },
            { header: "When", cell: (r) => formatDateTime(r.incident.occurredAt) },
            { header: "Reported by", cell: (r) => fullName(r.reportedBy) },
            { header: "Severity", cell: (r) => <Chip tone={severityTone(r.incident.severity)}>{humanize(r.incident.severity)}</Chip> },
            { header: "Status", cell: (r) => <Chip tone={incidentTone(r.incident.status)} dot>{humanize(r.incident.status)}</Chip> },
          ]}
        />
      )}
    </>
  );
}
