import type { Shift } from "@/data/types";

export function fullName(p: { firstName: string; lastName: string } | undefined): string {
  return p ? `${p.firstName} ${p.lastName}` : "—";
}

export function initials(p: { firstName: string; lastName: string }): string {
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
}

export function ageFrom(dateOfBirth: string, today = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" });
const time24Fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const weekdayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Accepts "YYYY-MM-DD" (read as a local date) or a full ISO timestamp. */
function parse(value: string): Date {
  return value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
}

export const formatDate = (v: string | null) => (v ? dateFmt.format(parse(v)) : "—");
export const formatDateTime = (v: string | null) => (v ? dateTimeFmt.format(parse(v)) : "—");
export const formatTime = (v: string) => timeFmt.format(parse(v));
/** Compact 24-hour time for dense schedule views. */
export const formatTime24 = (v: string) => time24Fmt.format(parse(v));
export const formatWeekday = (d: Date) => weekdayFmt.format(d);

export function relativeTime(iso: string, now = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(iso);
}

export function localIsoDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Value for <input type="datetime-local">. */
export function localDateTimeInput(d = new Date()): string {
  return `${localIsoDate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Parent spec §2.3: the logging screen defaults to the current shift. */
export function currentShift(d = new Date()): Shift {
  const h = d.getHours();
  if (h >= 6 && h < 14) return "MORNING";
  if (h >= 14 && h < 22) return "EVENING";
  return "NIGHT";
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
