"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Card, CardTitle, Chip, EmptyState, KeyValue, Notice } from "@/components/ui/primitives";
import { getIncident, useActions, useQuery, useRequiredViewer } from "@/lib/data-source";
import { humanize, incidentTone, severityTone } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { formatDateTime, fullName } from "@/lib/format";

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const viewer = useRequiredViewer();
  const actions = useActions();
  const row = useQuery(getIncident, id);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!row) {
    return (
      <EmptyState
        title="Incident not found"
        action={<Link href="/incidents" className={buttonClasses("secondary")}>Back to incidents</Link>}
      />
    );
  }
  const { incident, resident, reportedBy, reviewedBy } = row;
  const reviewer = can(viewer.role, "incident.review");
  const run = (r: { ok: boolean; error?: string }) => setError(r.ok ? null : (r.error ?? "Something went wrong."));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/incidents" className="mb-2 inline-flex min-h-11 items-center text-sm text-ink-500 hover:text-ink-900">
        ← Incidents
      </Link>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">{humanize(incident.type)}</h1>
          <p className="mt-1 text-sm text-ink-500">
            <Link href={`/service-user/${resident?.id}`} className="font-medium text-brand-700 hover:underline">
              {fullName(resident)}
            </Link>{" "}
            · {formatDateTime(incident.occurredAt)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip tone={incidentTone(incident.status)} dot>{humanize(incident.status)}</Chip>
            <Chip tone={severityTone(incident.severity)}>Severity: {humanize(incident.severity)}</Chip>
            {incident.notifyParent && <Chip tone="brand">Parent informed</Chip>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {reviewer && incident.status === "REPORTED" && (
            <Button onClick={() => run(actions.reviewIncident({ incidentId: incident.id, action: "START_REVIEW" }))}>
              Start review
            </Button>
          )}
          {reviewer && incident.status === "UNDER_REVIEW" && (
            <Button variant="danger" onClick={() => run(actions.reviewIncident({ incidentId: incident.id, action: "ESCALATE" }))}>
              Escalate
            </Button>
          )}
          {reviewer && ["UNDER_REVIEW", "ESCALATED"].includes(incident.status) && (
            <Button variant="success" onClick={() => setResolving(true)}>
              Resolve
            </Button>
          )}
          {can(viewer.role, "incident.close") && incident.status === "RESOLVED" && (
            <Button variant="secondary" onClick={() => run(actions.closeIncident({ incidentId: incident.id }))}>
              Close incident
            </Button>
          )}
        </div>
      </div>

      {error && <div className="mb-4"><Notice tone="danger">{error}</Notice></div>}

      <div className="space-y-4">
        <Card>
          <CardTitle>What happened</CardTitle>
          <p className="whitespace-pre-line text-sm text-ink-900">{incident.description}</p>
        </Card>
        <Card>
          <KeyValue
            items={[
              ["Location", incident.location ?? "—"],
              ["Reported by", `${fullName(reportedBy)} · ${formatDateTime(incident.createdAt)}`],
              ["Reviewed by", reviewedBy ? fullName(reviewedBy) : "Not yet reviewed"],
              ["Resolved", formatDateTime(incident.resolvedAt)],
            ]}
          />
        </Card>
        {incident.resolution && (
          <Card>
            <CardTitle>Resolution</CardTitle>
            <p className="text-sm text-ink-900">{incident.resolution}</p>
          </Card>
        )}
      </div>

      <Dialog
        open={resolving}
        onClose={() => setResolving(false)}
        title="Resolve incident"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolving(false)}>Cancel</Button>
            <Button
              variant="success"
              disabled={!resolution.trim()}
              onClick={() => {
                const r = actions.reviewIncident({ incidentId: incident.id, action: "RESOLVE", resolution });
                run(r);
                if (r.ok) setResolving(false);
              }}
            >
              Resolve
            </Button>
          </>
        }
      >
        <Field label="How was it resolved?" htmlFor="resolution">
          <Textarea id="resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
