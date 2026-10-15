import type { ReactNode } from "react";
import { TONE_CLASSES, TONE_DOT } from "@/config/theme";
import type { Tone } from "@/lib/domain/labels";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl bg-surface shadow-sm ring-1 ring-line ${padded ? "p-4 sm:p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-ink-900">{children}</h2>
      {action}
    </div>
  );
}

export function Chip({ tone, children, dot = false }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {dot && <span className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} />}
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <p className="font-medium text-ink-900">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger" | "warning";
  children: ReactNode;
}) {
  const styles = {
    info: "bg-sky-50 text-sky-900 ring-sky-200",
    success: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    danger: "bg-rose-50 text-rose-900 ring-rose-200",
    warning: "bg-amber-50 text-amber-900 ring-amber-200",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${styles}`}>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export function KeyValue({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-ink-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const cls = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-14 text-lg" }[size];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 ${cls}`}
    >
      {name}
    </span>
  );
}

/** A horizontal proportion bar, 0..1. */
export function Bar({ value, tone = "brand" }: { value: number; tone?: Tone }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${TONE_DOT[tone]}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}
