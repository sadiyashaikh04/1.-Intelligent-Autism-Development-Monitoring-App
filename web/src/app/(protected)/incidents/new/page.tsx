"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Select, Textarea } from "@/components/ui/form";
import { Notice, PageHeader } from "@/components/ui/primitives";
import type { IncidentType, NotificationSeverity } from "@/data/types";
import { listResidents, useActions, useQuery } from "@/lib/data-source";
import { humanize } from "@/lib/domain/labels";
import { localDateTimeInput } from "@/lib/format";

const TYPES: IncidentType[] = ["MELTDOWN", "AGGRESSION", "SELF_HARM", "INJURY", "FALL", "ELOPEMENT", "OTHER_INCIDENT"];
const SEVERITIES: Array<{ value: NotificationSeverity; label: string; tone: string }> = [
  { value: "NORMAL", label: "Normal", tone: "bg-slate-700 text-white ring-slate-700" },
  { value: "HIGH", label: "High", tone: "bg-amber-500 text-white ring-amber-500" },
  { value: "CRITICAL_INTERRUPT", label: "Critical", tone: "bg-rose-600 text-white ring-rose-600" },
];

/** Mobile-first incident report (parent spec §2.3, §5.4). */
export default function ReportIncidentPage() {
  const router = useRouter();
  const actions = useActions();
  const residents = useQuery(listResidents, {});
  const parentLinks = useQuery((db) => db.residentParents);
  const [residentId, setResidentId] = useState(residents[0]?.id ?? "");
  const [type, setType] = useState<IncidentType>("MELTDOWN");
  const [severity, setSeverity] = useState<NotificationSeverity>("NORMAL");
  const [occurredAt, setOccurredAt] = useState(localDateTimeInput());
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [notifyParent, setNotifyParent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasParent = parentLinks.some((p) => p.residentId === residentId);

  function submit(e: FormEvent) {
    e.preventDefault();
    const result = actions.reportIncident({
      residentId,
      type,
      severity,
      occurredAt: new Date(occurredAt).toISOString(),
      location,
      description,
      notifyParent: hasParent && notifyParent,
    });
    if (!result.ok || !result.createdId) return setError(result.error ?? "Could not save the report.");
    router.push(`/incidents/${result.createdId}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl pb-28">
      <Link href="/incidents" className="mb-2 inline-flex min-h-11 items-center text-sm text-ink-500 hover:text-ink-900">
        ← Incidents
      </Link>
      <PageHeader title="Report an incident" subtitle="The care team is notified as soon as you submit." />

      <div className="space-y-4">
        <Field label="Service user" htmlFor="inc-resident">
          <Select id="inc-resident" value={residentId} onChange={(e) => setResidentId(e.target.value)} required>
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.firstName} {r.lastName} · {r.code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="What happened" htmlFor="inc-type">
          <Select id="inc-type" value={type} onChange={(e) => setType(e.target.value as IncidentType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Severity">
          <Segmented name="Severity" value={severity} options={SEVERITIES} onChange={setSeverity} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="When" htmlFor="inc-when">
            <Input
              id="inc-when"
              type="datetime-local"
              max={localDateTimeInput()}
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
            />
          </Field>
          <Field label="Where (optional)" htmlFor="inc-where">
            <Input id="inc-where" placeholder="e.g. Activity Hall" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>
        <Field label="Description" htmlFor="inc-desc" hint="What happened, what you did, and how they are now.">
          <Textarea id="inc-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </Field>
        {hasParent && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-surface px-3 py-2 ring-1 ring-inset ring-line">
            <input
              type="checkbox"
              className="size-5 accent-brand-600"
              checked={notifyParent}
              onChange={(e) => setNotifyParent(e.target.checked)}
            />
            <span className="text-sm text-ink-900">Let the parent know</span>
          </label>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 p-3 backdrop-blur lg:left-60">
        <div className="mx-auto max-w-2xl">
          <Button type="submit" size="lg" className="w-full" disabled={!description.trim() || !residentId}>
            Submit report
          </Button>
        </div>
      </div>
    </form>
  );
}
