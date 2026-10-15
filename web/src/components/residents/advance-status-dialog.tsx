"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Notice } from "@/components/ui/primitives";
import type { Resident, ResidentStatus } from "@/data/types";
import { listUsers, useActions, useQuery } from "@/lib/data-source";
import { RESIDENT_STATUS_LABELS } from "@/lib/domain/labels";
import { manualNextStatuses } from "@/lib/domain/transitions";
import { fullName } from "@/lib/format";

/**
 * CSC-only. Offers just the allow-listed manual next steps; the mutation
 * re-checks, so an illegal jump is impossible even if this UI were wrong.
 */
export function AdvanceStatusDialog({
  resident,
  open,
  onClose,
}: {
  resident: Resident;
  open: boolean;
  onClose: () => void;
}) {
  const actions = useActions();
  const users = useQuery((db) => listUsers(db));
  const options = manualNextStatuses(resident.status);
  const [toStatus, setToStatus] = useState<ResidentStatus | "">(options[0] ?? "");
  const [reason, setReason] = useState("");
  const [psychologistId, setPsychologistId] = useState("");
  const [pssId, setPssId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsTeam = toStatus === "MDT_ASSIGNED";
  const active = users.filter((u) => u.isActive);

  function submit() {
    if (!toStatus) return;
    const result = actions.advanceResidentStatus({
      residentId: resident.id,
      toStatus,
      reason,
      team: needsTeam ? { psychologistId, pssId } : undefined,
    });
    if (result.ok) {
      setReason("");
      onClose();
    } else setError(result.error ?? "Something went wrong.");
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Advance ${resident.firstName}'s status`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!toStatus || (needsTeam && (!psychologistId || !pssId))}
          >
            Confirm
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-500">
        Currently <strong className="text-ink-900">{RESIDENT_STATUS_LABELS[resident.status]}</strong>. Only the
        next allowed step is offered; later steps happen automatically as assessments and plans are approved.
      </p>
      <Field label="Move to" htmlFor="to-status">
        <Select id="to-status" value={toStatus} onChange={(e) => setToStatus(e.target.value as ResidentStatus)}>
          {options.map((s) => (
            <option key={s} value={s}>
              {RESIDENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      {needsTeam && (
        <>
          <Field label="Junior psychologist" htmlFor="psych">
            <Select id="psych" value={psychologistId} onChange={(e) => setPsychologistId(e.target.value)}>
              <option value="">Choose…</option>
              {active
                .filter((u) => u.role === "JR_PSYCHOLOGIST")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {fullName(u)}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Personal support staff" htmlFor="pss">
            <Select id="pss" value={pssId} onChange={(e) => setPssId(e.target.value)}>
              <option value="">Choose…</option>
              {active
                .filter((u) => u.role === "PSS")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {fullName(u)}
                  </option>
                ))}
            </Select>
          </Field>
          <p className="text-xs text-ink-500">The MDT head is added to the care team automatically.</p>
        </>
      )}
      <Field label="Reason (optional)" htmlFor="reason">
        <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
    </Dialog>
  );
}
