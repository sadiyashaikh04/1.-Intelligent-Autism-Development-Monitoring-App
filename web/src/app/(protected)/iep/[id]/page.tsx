"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Card, CardTitle, Chip, EmptyState, Notice } from "@/components/ui/primitives";
import type { ClinicalDomain, GoalFrequency, IepAssignedRole } from "@/data/types";
import { GOAL_TEMPLATES, getIepPlan, useActions, useQuery, useRequiredViewer } from "@/lib/data-source";
import { DOMAIN_LABELS, goalApprovalTone, humanize, iepTone } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { formatDate, fullName } from "@/lib/format";

const DOMAINS = Object.keys(DOMAIN_LABELS) as ClinicalDomain[];
const FREQUENCIES: GoalFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];
const EMPTY_GOAL = {
  domain: "PSYCHOLOGY" as ClinicalDomain,
  title: "",
  description: "",
  frequency: "DAILY" as GoalFrequency,
  targetCount: 20,
  assignedRole: "PSS" as IepAssignedRole,
};

export default function IepPlanPage() {
  const { id } = useParams<{ id: string }>();
  const viewer = useRequiredViewer();
  const actions = useActions();
  const row = useQuery(getIepPlan, id);
  const [goal, setGoal] = useState(EMPTY_GOAL);
  const [template, setTemplate] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!row) {
    return (
      <EmptyState
        title="Plan not found"
        action={<Link href="/iep" className={buttonClasses("secondary")}>Back to plans</Link>}
      />
    );
  }

  const { plan, resident, author, goals } = row;
  const isAuthor = can(viewer.role, "iep.author") && plan.authoredByUserId === viewer.id;
  const isReviewer = can(viewer.role, "iep.review");
  const run = (r: { ok: boolean; error?: string }, success?: string) => {
    setError(r.ok ? null : (r.error ?? "Something went wrong."));
    if (r.ok && success) setNotice(success);
    return r.ok;
  };

  function addGoal() {
    if (run(actions.addIepGoal({ planId: plan.id, ...goal }), "Goal added.")) {
      setGoal(EMPTY_GOAL);
      setTemplate("");
    }
  }

  function applyTemplate(index: string) {
    setTemplate(index);
    const t = GOAL_TEMPLATES[Number(index)];
    if (t) setGoal({ ...t });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/iep" className="mb-2 inline-flex min-h-11 items-center text-sm text-ink-500 hover:text-ink-900">
        ← IEP plans
      </Link>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">
            {fullName(resident)} · IEP v{plan.version}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Authored by {fullName(author)} · {formatDate(plan.createdAt)}
          </p>
          <div className="mt-2">
            <Chip tone={iepTone(plan.status)}>{humanize(plan.status)}</Chip>
          </div>
        </div>
        {isAuthor && plan.status === "DRAFT_IEP" && (
          <Button
            disabled={goals.length === 0}
            onClick={() => run(actions.submitIepPlan({ planId: plan.id }), "Plan submitted to the MDT head for goal approval.")}
          >
            Submit for approval
          </Button>
        )}
        {can(viewer.role, "iep.activate") && plan.status === "APPROVED_IEP" && (
          <Button variant="success" onClick={() => run(actions.activateIepPlan({ planId: plan.id }), "Plan activated.")}>
            Activate plan
          </Button>
        )}
      </div>

      {error && <div className="mb-4"><Notice tone="danger">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
      {plan.status === "REJECTED_IEP" && (
        <div className="mb-4">
          <Notice tone="warning">Every goal was rejected. Rejection is final per goal — author a new version from the IEP page.</Notice>
        </div>
      )}

      <Card padded={false} className="mb-4">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold text-ink-900">Goals ({goals.length})</h2>
        </div>
        {goals.length === 0 ? (
          <p className="p-4 text-sm text-ink-500">No goals yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {goals.map(({ goal: g }) => (
              <li key={g.id} className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">{g.title}</p>
                    <p className="text-sm text-ink-500">{g.description}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {DOMAIN_LABELS[g.domain]} · {humanize(g.frequency)} · target {g.targetCount} ·{" "}
                      {g.assignedRole === "PSS" ? "practised by PSS" : "led by clinician"}
                    </p>
                    {g.rejectionReason && <p className="mt-1 text-xs text-rose-700">Rejected: {g.rejectionReason}</p>}
                  </div>
                  <Chip tone={goalApprovalTone(g.approvalStatus)}>{humanize(g.approvalStatus)}</Chip>
                </div>
                {isReviewer && g.approvalStatus === "PENDING_MDT_APPROVAL" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => run(actions.reviewIepGoal({ goalId: g.id, decision: "APPROVE", reason: "" }))}
                    >
                      Approve
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => { setRejecting(g.id); setReason(""); }}>
                      Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAuthor && plan.status === "DRAFT_IEP" && (
        <Card>
          <CardTitle>Add a goal</CardTitle>
          <div className="space-y-4">
            <Field label="Start from a suggestion (optional)" htmlFor="tpl">
              <Select id="tpl" value={template} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Write my own…</option>
                {GOAL_TEMPLATES.map((t, i) => (
                  <option key={t.title} value={i}>
                    {DOMAIN_LABELS[t.domain]}: {t.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" htmlFor="g-title">
              <Input id="g-title" value={goal.title} onChange={(e) => setGoal({ ...goal, title: e.target.value })} />
            </Field>
            <Field label="Description" htmlFor="g-desc">
              <Textarea id="g-desc" value={goal.description} onChange={(e) => setGoal({ ...goal, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Domain" htmlFor="g-domain">
                <Select id="g-domain" value={goal.domain} onChange={(e) => setGoal({ ...goal, domain: e.target.value as ClinicalDomain })}>
                  {DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>)}
                </Select>
              </Field>
              <Field label="Frequency" htmlFor="g-freq">
                <Select id="g-freq" value={goal.frequency} onChange={(e) => setGoal({ ...goal, frequency: e.target.value as GoalFrequency })}>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{humanize(f)}</option>)}
                </Select>
              </Field>
              <Field label="Target (sessions)" htmlFor="g-target">
                <Input
                  id="g-target"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={goal.targetCount}
                  onChange={(e) => setGoal({ ...goal, targetCount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Practised by" htmlFor="g-role">
                <Select id="g-role" value={goal.assignedRole} onChange={(e) => setGoal({ ...goal, assignedRole: e.target.value as IepAssignedRole })}>
                  <option value="PSS">Support staff (daily)</option>
                  <option value="CLINICIAN">Clinician (sessions)</option>
                </Select>
              </Field>
            </div>
            <Button variant="secondary" onClick={addGoal} disabled={!goal.title.trim()}>
              Add goal
            </Button>
          </div>
        </Card>
      )}

      <Dialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this goal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                if (rejecting && run(actions.reviewIepGoal({ goalId: rejecting, decision: "REJECT", reason }))) setRejecting(null);
              }}
            >
              Reject goal
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-500">Rejection is final for this goal; the psychologist writes a replacement in a new version.</p>
        <Field label="Reason" htmlFor="goal-reason">
          <Textarea id="goal-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
