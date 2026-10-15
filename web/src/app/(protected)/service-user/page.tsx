"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResidentStatusChip } from "@/components/residents/status";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import type { Resident, ResidentStatus } from "@/data/types";
import { listResidents, useQuery, useRequiredViewer } from "@/lib/data-source";
import { RESIDENT_STATUS_LABELS, humanize } from "@/lib/domain/labels";
import { navFor } from "@/lib/domain/permissions";
import { ageFrom, formatDate } from "@/lib/format";

export default function ServiceUsersPage() {
  const router = useRouter();
  const viewer = useRequiredViewer();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ResidentStatus | "">("");
  const residents = useQuery(listResidents, { q, status });
  const all = useQuery(listResidents, {});
  const title = navFor(viewer.role).find((n) => n.key === "service-user")?.label ?? "Service Users";
  const scoped = viewer.role === "PSS" || viewer.role === "JR_PSYCHOLOGIST";

  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          scoped
            ? `${all.length} service users assigned to you`
            : `${all.length} service users across every stage of care`
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,24rem)_minmax(0,16rem)]">
        <Field label="Search" htmlFor="q">
          <Input
            id="q"
            type="search"
            placeholder="Name or code, e.g. RES-0009"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as ResidentStatus | "")}>
            <option value="">All statuses</option>
            {(Object.keys(RESIDENT_STATUS_LABELS) as ResidentStatus[]).map((s) => (
              <option key={s} value={s}>
                {RESIDENT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {residents.length === 0 ? (
        <EmptyState
          title="No service users match"
          body={q || status ? "Try a different search or status." : "Nobody is assigned to you yet."}
        />
      ) : (
        <DataTable<Resident>
          rows={residents}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/service-user/${r.id}`)}
          mobileTitle={(r) => (
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">
                {r.firstName} {r.lastName}
              </span>
              <span className="text-xs font-normal text-ink-500">{r.code}</span>
            </span>
          )}
          columns={[
            { header: "Code", cell: (r) => <span className="font-mono text-xs text-ink-500">{r.code}</span>, desktopOnly: true },
            {
              header: "Name",
              cell: (r) => (
                <span className="font-medium text-ink-900">
                  {r.firstName} {r.lastName}
                </span>
              ),
              desktopOnly: true,
            },
            { header: "Age", cell: (r) => ageFrom(r.dateOfBirth) },
            { header: "Gender", cell: (r) => humanize(r.gender), desktopOnly: true },
            { header: "Programme", cell: (r) => humanize(r.programType) },
            { header: "Status", cell: (r) => <ResidentStatusChip status={r.status} />, wide: true },
            { header: "Admitted", cell: (r) => formatDate(r.admissionDate), desktopOnly: true },
          ]}
        />
      )}
    </>
  );
}
