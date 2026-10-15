import { Chip } from "@/components/ui/primitives";
import type { ResidentStatus } from "@/data/types";
import { RESIDENT_STATUS_LABELS, residentStatusTone } from "@/lib/domain/labels";
import { RESIDENT_JOURNEY } from "@/lib/domain/transitions";

export function ResidentStatusChip({ status }: { status: ResidentStatus }) {
  return (
    <Chip tone={residentStatusTone(status)} dot>
      {RESIDENT_STATUS_LABELS[status]}
    </Chip>
  );
}

/** Where the resident is on the enrolment-to-active journey. */
export function JourneyStrip({ status }: { status: ResidentStatus }) {
  const current = RESIDENT_JOURNEY.indexOf(status);
  return (
    <div>
      <div className="flex gap-1" aria-hidden>
        {RESIDENT_JOURNEY.map((step, i) => (
          <div
            key={step}
            title={RESIDENT_STATUS_LABELS[step]}
            className={`h-1.5 flex-1 rounded-full ${
              status === "INACTIVE" ? "bg-slate-200" : i <= current ? "bg-brand-500" : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-500">
        {status === "INACTIVE"
          ? "Inactive — paused from the active programme"
          : `Step ${current + 1} of ${RESIDENT_JOURNEY.length}: ${RESIDENT_STATUS_LABELS[status]}`}
      </p>
    </div>
  );
}
