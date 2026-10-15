import type { Iso, IsoDate } from "@/data/types";

/**
 * Deterministic PRNG (mulberry32). The sample data must look the same on
 * every load so a demo script stays true; Math.random would not.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error("pick from empty list");
  return item;
}

/** Local calendar date, so "today" matches the viewer's wall clock. */
export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** A timestamp `days` from today at a local wall-clock time. */
export function at(today: Date, days: number, hour: number, minute = 0): Iso {
  const d = addDays(today, days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function dateOffset(today: Date, days: number): IsoDate {
  return toIsoDate(addDays(today, days));
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}
