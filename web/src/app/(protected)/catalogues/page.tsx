"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/overlay";
import { Chip, PageHeader } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import type { AdlActivity, AssessmentType, Room } from "@/data/types";
import { useQuery } from "@/lib/data-source";
import { DOMAIN_LABELS, humanize } from "@/lib/domain/labels";

type Tab = "assessments" | "adl" | "rooms";

export default function CataloguesPage() {
  const [tab, setTab] = useState<Tab>("assessments");
  const types = useQuery((db) => db.assessmentTypes);
  const activities = useQuery((db) => db.adlActivities);
  const rooms = useQuery((db) => db.rooms);

  return (
    <>
      <PageHeader title="Catalogues" subtitle="Reference lists the rest of the system draws on." />
      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "assessments", label: "Assessment types", count: types.length },
          { key: "adl", label: "ADL activities", count: activities.length },
          { key: "rooms", label: "Rooms", count: rooms.length },
        ]}
      />
      <div className="mt-4">
        {tab === "assessments" && (
          <>
            <p className="mb-3 text-sm text-ink-500">
              Descriptive names with simplified rubrics of our own — not an implementation of ADOS-2, CARS-2,
              Vineland-3, ISAA or any other licensed instrument.
            </p>
            <DataTable<AssessmentType>
              rows={types}
              rowKey={(t) => t.id}
              mobileTitle={(t) => t.name}
              columns={[
                { header: "Name", cell: (t) => <span className="font-medium">{t.name}</span>, desktopOnly: true },
                { header: "Code", cell: (t) => <span className="font-mono text-xs">{t.code}</span> },
                { header: "Domain", cell: (t) => DOMAIN_LABELS[t.domain] },
                { header: "Description", cell: (t) => <span className="text-ink-700">{t.description}</span>, wide: true },
              ]}
            />
          </>
        )}
        {tab === "adl" && (
          <DataTable<AdlActivity>
            rows={activities}
            rowKey={(a) => a.id}
            mobileTitle={(a) => a.name}
            columns={[
              { header: "Name", cell: (a) => <span className="font-medium">{a.name}</span>, desktopOnly: true },
              { header: "Code", cell: (a) => <span className="font-mono text-xs">{a.code}</span> },
              { header: "Category", cell: (a) => <Chip tone={a.category === "ADL" ? "brand" : "info"}>{a.category}</Chip> },
              { header: "Description", cell: (a) => <span className="text-ink-700">{a.description}</span>, wide: true },
            ]}
          />
        )}
        {tab === "rooms" && (
          <DataTable<Room>
            rows={rooms}
            rowKey={(r) => r.id}
            mobileTitle={(r) => r.name}
            columns={[
              { header: "Name", cell: (r) => <span className="font-medium">{r.name}</span>, desktopOnly: true },
              { header: "Type", cell: (r) => humanize(r.type) },
              { header: "Capacity", cell: (r) => r.capacity },
              { header: "Status", cell: (r) => <Chip tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Chip> },
            ]}
          />
        )}
      </div>
    </>
  );
}
