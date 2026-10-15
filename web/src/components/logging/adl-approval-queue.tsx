"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui/primitives";
import { listAdlLogs, useActions, useQuery, type AdlLogRow } from "@/lib/data-source";
import { humanize } from "@/lib/domain/labels";
import { formatDate, fullName } from "@/lib/format";

/** CSC queue of SUBMITTED ADL logs (parent spec §5.3 step 4). */
export function AdlApprovalQueue() {
  const actions = useActions();
  const pending = useQuery(listAdlLogs, { approvalStatus: "SUBMITTED" });
  const [rejecting, setRejecting] = useState<AdlLogRow | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, AdlLogRow[]>();
    for (const row of pending) {
      const k = row.resident?.id ?? "?";
      map.set(k, [...(map.get(k) ?? []), row]);
    }
    return [...map.values()];
  }, [pending]);

  function approve(rows: AdlLogRow[]) {
    const ok = rows.filter((row) => actions.reviewAdlLog({ logId: row.log.id, decision: "APPROVE", reason: "" }).ok).length;
    setNotice(`${ok} ${ok === 1 ? "log" : "logs"} approved.`);
  }

  function reject() {
    if (!rejecting) return;
    const result = actions.reviewAdlLog({ logId: rejecting.log.id, decision: "REJECT", reason });
    if (!result.ok) return setError(result.error ?? "Could not reject.");
    setNotice("Log returned to the PSS with your reason.");
    setRejecting(null);
    setReason("");
  }

  return (
    <>
      <PageHeader
        title="ADL approvals"
        subtitle={`${pending.length} daily activity ${pending.length === 1 ? "log" : "logs"} waiting for review`}
      />
      {notice && (
        <div className="mb-4">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}
      {grouped.length === 0 ? (
        <EmptyState title="All caught up" body="New logs appear here as support staff submit them." />
      ) : (
        <div className="space-y-4">
          {grouped.map((rows) => {
            const resident = rows[0]!.resident;
            return (
              <Card key={resident?.id} padded={false}>
                <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink-900">
                      {resident?.firstName} {resident?.lastName}
                    </p>
                    <p className="text-xs text-ink-500">{resident?.code} · {rows.length} pending</p>
                  </div>
                  <Button variant="success" size="sm" onClick={() => approve(rows)}>
                    Approve all
                  </Button>
                </div>
                <ul className="divide-y divide-line">
                  {rows.map((row) => (
                    <li key={row.log.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-ink-900">{row.activity?.name}</p>
                        <p className="text-xs text-ink-500">
                          {formatDate(row.log.logDate)} · {humanize(row.log.shift)} · by {fullName(row.loggedBy)}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-700">
                          {humanize(row.log.status)}
                          {row.log.promptLevel && ` · ${humanize(row.log.promptLevel)}`}
                          {row.log.mood ? ` · ${humanize(row.log.mood)}` : " · mood not recorded"}
                        </p>
                        {row.log.notes && <p className="mt-0.5 text-sm italic text-ink-500">“{row.log.notes}”</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => { setRejecting(row); setError(null); }}>
                          Reject
                        </Button>
                        <Button variant="success" size="sm" onClick={() => approve([row])}>
                          Approve
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Return this log"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={reject} disabled={!reason.trim()}>
              Return to PSS
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-500">
          {rejecting?.activity?.name} for {rejecting?.resident?.firstName}. The PSS is notified with your reason.
        </p>
        <Field label="Reason" htmlFor="reject-reason">
          <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </Dialog>
    </>
  );
}
