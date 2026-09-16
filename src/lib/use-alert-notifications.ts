import { useEffect, useRef } from "react";
import type { Widget } from "@/workspace/types";
import { reminderAlertPhase } from "@/lib/reminder-alert";
import { taskAlertPhase } from "@/lib/task-schedule";
import { reminderState, taskState } from "@/components/workspace/WidgetContent";

/**
 * Requests notification permission once, on first load. While the app
 * stays open, keeps the OS taskbar/dock badge in sync with how many
 * reminders/tasks are currently "due", and fires one native notification
 * per item the moment it becomes due (won't repeat until it's rescheduled
 * or reopened). There's no service worker or push backend, so nothing
 * fires while the app is fully closed — only while it's open, including
 * minimized/backgrounded.
 */
export function useAlertNotifications(widgets: Widget[]) {
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      let dueCount = 0;

      for (const w of widgets) {
        if (w.content.kind === "reminders") {
          for (const r of w.content.items) {
            if (reminderState(r) === "completed" || reminderState(r) === "archived") continue;
            const phase = reminderAlertPhase(r, now);
            if (phase !== "due") {
              notified.current.delete(r.id);
              continue;
            }
            dueCount += 1;
            if (!notified.current.has(r.id) && typeof Notification !== "undefined" && Notification.permission === "granted") {
              notified.current.add(r.id);
              new Notification(r.title || "Reminder", { body: "It's time.", tag: r.id });
            }
          }
        } else if (w.content.kind === "tasks") {
          for (const t of w.content.items) {
            if (taskState(t.status) === "completed") continue;
            const phase = taskAlertPhase(t, now);
            if (phase !== "due") {
              notified.current.delete(t.id);
              continue;
            }
            dueCount += 1;
            if (!notified.current.has(t.id) && typeof Notification !== "undefined" && Notification.permission === "granted") {
              notified.current.add(t.id);
              new Notification(t.title || "Task", { body: "It's due now.", tag: t.id });
            }
          }
        }
      }

      if ("setAppBadge" in navigator) {
        if (dueCount > 0) (navigator as any).setAppBadge(dueCount);
        else if ("clearAppBadge" in navigator) (navigator as any).clearAppBadge();
      }
    };

    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [widgets]);
}
