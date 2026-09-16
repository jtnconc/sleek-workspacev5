import type { ReminderItem } from "@/workspace/types";

/** Selectable "Notify me" thresholds for a reminder's alert, in minutes
 * before the scheduled date/time (0 = at time of event). */
export const NOTIFY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "At time of event" },
  { value: 5, label: "5 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
];

export const DEFAULT_NOTIFY_MINUTES = 15;

/** Legacy values may store "2026-08-18 09:00" in `date`. */
function splitWhen(r: Pick<ReminderItem, "date" | "time">) {
  const [d, t] = (r.date ?? "").split(" ");
  return { date: d ?? "", time: r.time ?? t ?? "" };
}

/** Resolves a reminder's scheduled date/time into a concrete `Date`, or
 * `null` when it has no usable date. A reminder without a time is treated
 * as due at the very start of that day (00:00). */
export function reminderDateTime(r: Pick<ReminderItem, "date" | "time">): Date | null {
  const { date, time } = splitWhen(r);
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

/**
 * True once "now" has reached the reminder's configured alert threshold
 * (e.g. 15 minutes before the scheduled time) and until the scheduled time
 * has fully passed. Reminders without a date/time never trigger.
 */
export function isReminderAlertActive(
  r: Pick<ReminderItem, "date" | "time" | "notifyMinutesBefore">,
  now: Date = new Date(),
): boolean {
  const due = reminderDateTime(r);
  if (!due) return false;
  const minutesBefore = r.notifyMinutesBefore ?? DEFAULT_NOTIFY_MINUTES;
  const alertStart = due.getTime() - minutesBefore * 60_000;
  return now.getTime() >= alertStart && now.getTime() <= due.getTime() + 60_000 * 60 * 24;
}

export type AlertPhase = "none" | "pre" | "due";

/** Which phase of its alert window a reminder is in right now: "due" once
 * the scheduled time has arrived (stays "due" until the caller marks it
 * completed), "pre" during the configured "notify me before" lead time,
 * otherwise "none". */
export function reminderAlertPhase(
  r: Pick<ReminderItem, "date" | "time" | "notifyMinutesBefore">,
  now: Date = new Date(),
): AlertPhase {
  const due = reminderDateTime(r);
  if (!due) return "none";
  const minutesBefore = r.notifyMinutesBefore ?? DEFAULT_NOTIFY_MINUTES;
  const alertStart = due.getTime() - minutesBefore * 60_000;
  const t = now.getTime();
  if (t >= due.getTime()) return t <= due.getTime() + 60_000 * 60 * 24 ? "due" : "none";
  if (t >= alertStart) return "pre";
  return "none";
}
