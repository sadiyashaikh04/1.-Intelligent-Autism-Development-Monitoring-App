import type { Tone } from "@/lib/domain/labels";

/**
 * Single source for semantic colour classes. Base colours are Tailwind
 * tokens defined in app/globals.css; this maps meaning → classes.
 */
export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-rose-50 text-rose-800 ring-rose-200",
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-slate-400",
  info: "bg-sky-500",
  brand: "bg-brand-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

/** Chart series colours (Recharts needs raw values). */
export const CHART_COLORS = ["#4f5bc8", "#0ea5a4", "#e08a1e", "#c2417a"];
