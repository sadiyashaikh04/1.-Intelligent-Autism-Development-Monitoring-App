"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Notice } from "@/components/ui/primitives";
import type { Resident } from "@/data/types";
import { listUsers, useActions, useQuery } from "@/lib/data-source";
import { DOMAIN_LABELS } from "@/lib/domain/labels";
import { fullName, localDateTimeInput } from "@/lib/format";

function tomorrowAtTen(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return localDateTimeInput(d);
}

/** CSC books an assessment into a real calendar slot (parent spec §5.2 step 1). */
export function ScheduleAssessmentDialog({ resident, onClose }: { resident: Resident; onClose: () => void }) {
  const actions = useActions();
  const types = useQuery((db) => db.assessmentTypes.filter((t) => t.isActive));
  const rooms = useQuery((db) => db.rooms.filter((r) => r.isActive && ["ASSESSMENT_ROOM", "THERAPY", "CONSULTATION"].includes(r.type)));
  // Only the care-team psychologist: anyone else could not see the assessment.
  const psychologists = useQuery((db) => {
    const team = new Set(
      db.staffAssignments
        .filter((a) => a.residentId === resident.id && a.role === "JR_PSYCHOLOGIST" && !a.unassignedAt)
        .map((a) => a.userId),
    );
    return listUsers(db).filter((u) => team.has(u.id) && u.isActive);
  });
  const teamPsych = psychologists[0]?.id;
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [clinicianId, setClinicianId] = useState(teamPsych ?? psychologists[0]?.id ?? "");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState(tomorrowAtTen());
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!startsAt) return setError("Choose a date and time.");
    const result = actions.scheduleAssessment({
      residentId: resident.id,
      assessmentTypeId: typeId,
      assignedToUserId: clinicianId,
      roomId,
      startsAt: new Date(startsAt).toISOString(),
    });
    if (result.ok) onClose();
    else setError(result.error ?? "Could not schedule.");
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Schedule an assessment for ${resident.firstName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!typeId || !clinicianId || !roomId || !startsAt}>Schedule</Button>
        </>
      }
    >
      <Field label="Assessment" htmlFor="sa-type">
        <Select id="sa-type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {DOMAIN_LABELS[t.domain]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Clinician" htmlFor="sa-clinician">
        <Select id="sa-clinician" value={clinicianId} onChange={(e) => setClinicianId(e.target.value)}>
          {psychologists.map((u) => (
            <option key={u.id} value={u.id}>
              {fullName(u)} (care team)
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Room" htmlFor="sa-room">
          <Select id="sa-room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="When" htmlFor="sa-when" hint="One-hour slot">
          <Input id="sa-when" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-ink-500">
        This creates a calendar slot and notifies the clinician. Double bookings of the room or clinician are refused.
      </p>
      {error && <Notice tone="danger">{error}</Notice>}
    </Dialog>
  );
}
