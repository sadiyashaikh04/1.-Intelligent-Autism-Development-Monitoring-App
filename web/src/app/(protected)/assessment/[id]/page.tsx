"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Segmented, Textarea } from "@/components/ui/form";
import { Card, CardTitle, Chip, EmptyState, KeyValue, Notice } from "@/components/ui/primitives";
import type { FindingItem } from "@/data/types";
import { ASSESSMENT_ITEMS, getAssessment, useActions, useQuery, useRequiredViewer } from "@/lib/data-source";
import { DOMAIN_LABELS, assessmentTone, humanize } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { formatDateTime, fullName } from "@/lib/format";

const RATINGS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
const RATING_HELP = "1 = needs significant support · 5 = fully independent";

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const viewer = useRequiredViewer();
  const actions = useActions();
  const row = useQuery(getAssessment, id);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!row) {
    return (
      <EmptyState
        title="Assessment not found"
        body="It may not exist, or it is not assigned to you."
        action={<Link href="/assessment" className={buttonClasses("secondary")}>Back to assessments</Link>}
      />
    );
  }

  const { assessment: a, type, resident, assignee } = row;
  const isAssignee = can(viewer.role, "assessment.conduct") && a.assignedToUserId === viewer.id;
  const isReviewer = can(viewer.role, "assessment.review");
  const items = ASSESSMENT_ITEMS[a.assessmentTypeId] ?? [];
  const run = (r: { ok: boolean; error?: string }) => setError(r.ok ? null : (r.error ?? "Something went wrong."));

  function submit() {
    const findings: FindingItem[] = items.filter((item) => ratings[item]).map((item) => ({ item, rating: ratings[item]! }));
    run(actions.submitAssessment({ assessmentId: a.id, items: findings, summary }));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/assessment" className="mb-2 inline-flex min-h-11 items-center text-sm text-ink-500 hover:text-ink-900">
        ← Assessments
      </Link>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">{type?.name}</h1>
        <p className="mt-1 text-sm text-ink-500">
          <Link href={`/service-user/${resident?.id}`} className="font-medium text-brand-700 hover:underline">
            {fullName(resident)}
          </Link>{" "}
          · {type && DOMAIN_LABELS[type.domain]}
        </p>
        <div className="mt-2">
          <Chip tone={assessmentTone(a.status)}>{humanize(a.status)}</Chip>
        </div>
      </div>

      {error && <div className="mb-4"><Notice tone="danger">{error}</Notice></div>}

      <div className="space-y-4">
        <Card>
          <KeyValue
            items={[
              ["Clinician", fullName(assignee)],
              ["Scheduled", formatDateTime(a.scheduledAt)],
              ["Submitted", formatDateTime(a.submittedAt)],
              ["Score", a.score !== null ? `${a.score} / 100` : "—"],
            ]}
          />
          {type?.description && <p className="mt-4 text-sm text-ink-500">{type.description}</p>}
        </Card>

        {a.reviewNotes && (
          <Notice tone={a.status === "REVISION_REQUESTED" ? "warning" : "info"}>
            <strong>MDT review:</strong> {a.reviewNotes}
          </Notice>
        )}

        {isAssignee && (a.status === "SCHEDULED" || a.status === "REVISION_REQUESTED") && (
          <Card>
            <p className="text-sm text-ink-700">
              {a.status === "REVISION_REQUESTED"
                ? "The MDT head asked for changes. Start again to update your findings."
                : "Start the assessment when the session begins."}
            </p>
            <Button className="mt-3" onClick={() => run(actions.startAssessment({ assessmentId: a.id }))}>
              Start assessment
            </Button>
          </Card>
        )}

        {isAssignee && a.status === "IN_PROGRESS" && (
          <Card>
            <CardTitle>Findings</CardTitle>
            <p className="-mt-2 mb-4 text-xs text-ink-500">{RATING_HELP}</p>
            <div className="space-y-4">
              {items.map((item) => (
                <Field key={item} label={item}>
                  <Segmented
                    name={item}
                    value={ratings[item] ? String(ratings[item]) : null}
                    options={RATINGS}
                    onChange={(v) => setRatings((r) => ({ ...r, [item]: Number(v) }))}
                  />
                </Field>
              ))}
              <Field label="Summary of findings" htmlFor="summary">
                <Textarea id="summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </Field>
              <Button onClick={submit} disabled={Object.keys(ratings).length === 0 || !summary.trim()}>
                Submit for MDT review
              </Button>
            </div>
          </Card>
        )}

        {a.findings && (
          <Card>
            <CardTitle>Findings</CardTitle>
            <ul className="divide-y divide-line">
              {a.findings.items.map((f) => (
                <li key={f.item} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink-900">{f.item}</span>
                  <span className="flex items-center gap-1" aria-label={`${f.rating} of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`size-2.5 rounded-full ${n <= f.rating ? "bg-brand-500" : "bg-slate-200"}`} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-700">{a.findings.summary}</p>
          </Card>
        )}

        {isReviewer && a.status === "SUBMITTED" && (
          <Card>
            <CardTitle>Your review</CardTitle>
            <Field label="Notes" htmlFor="review-notes" hint="Required when requesting a revision.">
              <Textarea id="review-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button variant="success" onClick={() => run(actions.reviewAssessment({ assessmentId: a.id, decision: "APPROVE", notes }))}>
                Approve
              </Button>
              <Button
                variant="secondary"
                disabled={!notes.trim()}
                onClick={() => run(actions.reviewAssessment({ assessmentId: a.id, decision: "REVISION", notes }))}
              >
                Request revision
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
