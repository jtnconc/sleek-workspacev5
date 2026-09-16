import type { TaskItem } from "@/workspace/types";
import { DEFAULT_NOTIFY_MINUTES, type AlertPhase } from "@/lib/reminder-alert";

export const RECURRENCE_LABELS: Record<Exclude<TaskItem["recurrence"], undefined>, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekdays: "Mon–Fri",
  custom: "Custom days",
  "specific-time": "Specific time",
};

export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** True when a task is due today: recurring tasks on today's weekday, or one-off tasks whose date is today. */
export function isTaskDueToday(t: TaskItem): boolean {
  if (!t.recurrence || t.recurrence === "none") {
    if (!t.date) return false;
    const today = new Date();
    const todayStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    return t.date === todayStr;
  }
  const day = new Date().getDay();
  if (t.recurrence === "daily" || t.recurrence === "specific-time") return true;
  if (t.recurrence === "weekdays") return day >= 1 && day <= 5;
  if (t.recurrence === "custom") return (t.customDays ?? []).includes(day);
  return false;
}

/** Resolves a task's next scheduled date/time into a concrete `Date`, or
 * `null` when it has no usable schedule. Recurring tasks that apply today
 * resolve to today at their configured time. */
export function taskDateTime(t: TaskItem, now: Date = new Date()): Date | null {
  const recurs = !!t.recurrence && t.recurrence !== "none";
  let y: number, m: number, d: number;
  if (recurs) {
    if (!isTaskDueToday(t)) return null;
    y = now.getFullYear();
    m = now.getMonth() + 1;
    d = now.getDate();
  } else {
    if (!t.date) return null;
    const [yy, mm, dd] = t.date.split("-").map(Number);
    if (!yy || !mm || !dd) return null;
    y = yy;
    m = mm;
    d = dd;
  }
  const [hh, mi] = (t.time || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mi || 0, 0, 0);
}

/**
 * True once "now" has reached the task's configured alert threshold (e.g.
 * 15 minutes before its scheduled time) and until the scheduled time has
 * passed. Mirrors `isReminderAlertActive`.
 */
export function isTaskAlertActive(t: TaskItem, now: Date = new Date()): boolean {
  const due = taskDateTime(t, now);
  if (!due) return false;
  const minutesBefore = t.notifyMinutesBefore ?? DEFAULT_NOTIFY_MINUTES;
  const alertStart = due.getTime() - minutesBefore * 60_000;
  return now.getTime() >= alertStart && now.getTime() <= due.getTime() + 60_000 * 60 * 24;
}

export function taskAlertPhase(t: TaskItem, now: Date = new Date()): AlertPhase {
  const due = taskDateTime(t, now);
  if (!due) return "none";
  const minutesBefore = t.notifyMinutesBefore ?? DEFAULT_NOTIFY_MINUTES;
  const alertStart = due.getTime() - minutesBefore * 60_000;
  const ts = now.getTime();
  if (ts >= due.getTime()) return ts <= due.getTime() + 60_000 * 60 * 24 ? "due" : "none";
  if (ts >= alertStart) return "pre";
  return "none";
}
