import { createContext, useContext, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trash } from "@phosphor-icons/react";
import {
  AlarmClock,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Repeat,
  Star,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/workspace/store";
import type {
  ContactCategory,
  ContactItem,
  ItemStatus,
  NoteRefItem,
  ReminderItem,
  TaskItem,
  Widget,
} from "@/workspace/types";
import { DateField } from "@/components/common/DateField";
import { TimeField } from "@/components/common/TimeField";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { highlightHtml, highlightText, matchesQuery } from "@/lib/highlight";
import { RECURRENCE_LABELS, WEEKDAY_LABELS, isTaskAlertActive } from "@/lib/task-schedule";
import { DEFAULT_NOTIFY_MINUTES, NOTIFY_OPTIONS, isReminderAlertActive } from "@/lib/reminder-alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { accentVar, tintVar } from "./AccentControl";
import { FilterChips, type FilterChipOption } from "./FilterChips";

/** Filter chip definitions for each filterable widget kind — colors follow
 * the brief's grouping (warm tones for Reminders/Tasks, cool for Contacts)
 * while reusing the app's existing predefined accent palette. */
const REMINDER_FILTERS: FilterChipOption[] = [
  { value: "flagged", label: "Flagged", icon: Flag, accent: "red" },
  { value: "scheduled", label: "Scheduled", icon: Clock, accent: "orange" },
  { value: "completed", label: "Completed", icon: CheckCircle2, accent: "yellow" },
];

const TASK_FILTERS: FilterChipOption[] = [
  { value: "urgent", label: "Urgent", icon: AlarmClock, accent: "red" },
  { value: "scheduled", label: "Scheduled", icon: CalendarClock, accent: "orange" },
  { value: "completed", label: "Completed", icon: CheckCircle2, accent: "green" },
];

const CONTACT_FILTERS: FilterChipOption[] = [
  { value: "hotel", label: "Hotel", icon: Building2, accent: "blue" },
  { value: "agent", label: "Agents", icon: Users, accent: "purple" },
  { value: "client", label: "Clients", icon: UserRound, accent: "neutral" },
  { value: "favorite", label: "Favorite", icon: Star, accent: "yellow" },
];

/** Which quick filters a reminder currently satisfies (a reminder can match
 * more than one, e.g. flagged AND scheduled — chips act as an OR union). */
function reminderFilterValues(r: ReminderItem): string[] {
  const values: string[] = [];
  if (r.flagged) values.push("flagged");
  if (reminderState(r) === "completed") values.push("completed");
  else if (splitWhen(r).date) values.push("scheduled");
  return values;
}

function taskFilterValues(t: TaskItem): string[] {
  const values: string[] = [];
  if (t.priority === "urgent") values.push("urgent");
  if (taskState(t.status) === "completed") values.push("completed");
  else if (t.date || t.time || (t.recurrence && t.recurrence !== "none")) values.push("scheduled");
  return values;
}

const contactFilterValue = (p: ContactItem): string => p.category ?? "client";

/** How long a completed reminder/task stays visible in the default list. */
const HIDE_COMPLETED_AFTER_MS = 8 * 60 * 60 * 1000;
const isRecentlyCompleted = (completedAt?: number | null) =>
  !!completedAt && Date.now() - completedAt < HIDE_COMPLETED_AFTER_MS;

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Lets any action inside an open ItemActions popover close it after running. */
const ItemActionsCloseContext = createContext<() => void>(() => {});

/** Tiny inline action button used by contextual item controls. */
function MiniAction({
  label,
  onClick,
  closeOnClick = true,
  children,
}: {
  label: string;
  onClick: () => void;
  closeOnClick?: boolean;
  children: React.ReactNode;
}) {
  const closeMenu = useContext(ItemActionsCloseContext);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        if (closeOnClick) closeMenu();
      }}
      className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}

/**
 * Wrapper that reveals contextual actions on hover, or on tap (touch).
 * Actions are absolutely positioned over the item's trailing edge with a soft
 * fade so compact cards never get their content clipped or pushed around.
 */
function ItemActions({
  revealed,
  children,
}: {
  revealed: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="absolute right-1.5 top-1.5 z-10">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="More actions"
            onPointerDown={stop}
            onClick={stop}
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-opacity duration-200 hover:bg-secondary hover:text-foreground hover:opacity-100 focus-visible:opacity-100 data-[state=open]:bg-secondary data-[state=open]:opacity-100",
              revealed ? "opacity-100" : "opacity-0 group-hover:opacity-40",
            )}
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={4}
          onClick={stop}
          onPointerDown={stop}
          className="flex w-auto items-center gap-0.5 rounded-full border-border bg-popover p-1 shadow-lg"
        >
          <ItemActionsCloseContext.Provider value={() => setOpen(false)}>
            {children}
          </ItemActionsCloseContext.Provider>
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** Standard, subtle in-card delete confirmation used by every widget. */
function DeleteAction({
  label,
  confirming,
  onRequest,
  onCancel,
  onConfirm,
}: {
  label: string;
  confirming: boolean;
  onRequest: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirming)
    return (
      <MiniAction label={label} onClick={onRequest} closeOnClick={false}>
        <Trash size={12} />
      </MiniAction>
    );

  return (
    <>
      <MiniAction label={`Confirm ${label.toLowerCase()}`} onClick={onConfirm}>
        <Check className="size-3 text-destructive" />
      </MiniAction>
      <MiniAction label="Cancel delete" onClick={onCancel}>
        <X className="size-3" />
      </MiniAction>
    </>
  );
}

export const taskState = (s: string): ItemStatus =>
  s === "done" || s === "completed" ? "completed" : "active";

export const reminderState = (r: ReminderItem): ItemStatus =>
  r.status === "archived" ? "archived" : (r.status ?? (r.done ? "completed" : "active"));

/** Legacy values may be "2026-08-18 09:00". */
function splitWhen(r: ReminderItem) {
  const [d, t] = (r.date ?? "").split(" ");
  return { date: d ?? "", time: r.time ?? t ?? "" };
}

/** Formats a reminder's date/time as "MM/DD/YY, h:mm A" (e.g. "08/05/26, 3:00 PM"). */
function formatReminderWhen(when: { date: string; time: string }) {
  if (!when.date) return null;
  const [y, m, d] = when.date.split("-").map(Number);
  if (!y || !m || !d) return null;
  let result = `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${String(y).slice(-2)}`;

  if (when.time) {
    const [hh, mm] = when.time.split(":").map(Number);
    if (hh !== undefined && mm !== undefined && !Number.isNaN(hh) && !Number.isNaN(mm)) {
      const period = hh >= 12 ? "PM" : "AM";
      const h12 = hh % 12 === 0 ? 12 : hh % 12;
      result += `, ${h12}:${String(mm).padStart(2, "0")} ${period}`;
    }
  }

  return result;
}

const RECURRENCE_OPTIONS: Exclude<TaskItem["recurrence"], undefined>[] = [
  "none",
  "daily",
  "weekdays",
  "custom",
  "specific-time",
];

/** Inline repeat + date/time scheduling panel shared by every task row. */
function TaskSchedulePanel({
  task,
  accent,
  onChange,
  onDone,
}: {
  task: TaskItem;
  accent: string;
  onChange: (patch: Partial<TaskItem>) => void;
  onDone: () => void;
}) {
  const recurrence = task.recurrence ?? "none";
  return (
    <div className="mt-1.5 space-y-1.5" onClick={stop} onPointerDown={stop}>
      <Select
        value={recurrence}
        onValueChange={(v) =>
          onChange({ recurrence: v as Exclude<TaskItem["recurrence"], undefined> })
        }
      >
        <SelectTrigger
          aria-label="Repeat"
          className="h-auto w-full rounded-xl border-border bg-surface px-2 py-1 text-[11px] shadow-none focus:ring-0 focus-visible:border-ring"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {RECURRENCE_OPTIONS.map((r) => (
            <SelectItem key={r} value={r} className="text-[12px]">
              {RECURRENCE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {recurrence === "custom" && (
        <div className="flex gap-1">
          {WEEKDAY_LABELS.map((label, day) => {
            const active = (task.customDays ?? []).includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                aria-label={`Repeat on day ${day}`}
                onClick={() => {
                  const set = new Set(task.customDays ?? []);
                  if (set.has(day)) set.delete(day);
                  else set.add(day);
                  onChange({ customDays: [...set].sort() });
                }}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:bg-secondary",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <DateField
          size="sm"
          value={task.date ?? ""}
          onChange={(iso) => onChange({ date: iso })}
          placeholder="Pick a date"
          aria-label="Task date"
        />
        <TimeField value={task.time ?? ""} onChange={(t) => onChange({ time: t })} />
      </div>

      <Select
        value={String(task.notifyMinutesBefore ?? DEFAULT_NOTIFY_MINUTES)}
        onValueChange={(v) => onChange({ notifyMinutesBefore: Number(v) })}
      >
        <SelectTrigger
          aria-label="Notify me"
          className="h-auto w-full rounded-xl border-border bg-surface px-2 py-1 text-[11px] shadow-none focus:ring-0 focus-visible:border-ring"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {NOTIFY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)} className="text-[12px]">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={onDone}
        className="rounded-full px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:opacity-90"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, var(--surface-2))` }}
      >
        Done
      </button>
    </div>
  );
}

/** Placeholder shown when a widget list has no items to render. */
function EmptyState({ text }: { text: string }) {
  return <p className="px-1 py-2 text-[12px] text-muted-foreground">{text}</p>;
}

function TasksContent({
  widget,
  filtersOpen,
  selectedFilters,
  onToggleFilter,
}: {
  widget: Widget;
  filtersOpen: boolean;
  selectedFilters: string[];
  onToggleFilter: (value: string) => void;
}) {
  const { toggleTask, updateTask, deleteTask, searchQuery } = useWorkspace();
  const [tapped, setTapped] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  // Re-render periodically so the due-soon clock appears/disappears when the
  // current time crosses a task's configured "Notify me" threshold.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (widget.content.kind !== "tasks") return null;
  const showCompleted = selectedFilters.includes("completed");
  const items = widget.content.items
    .filter((t) => matchesQuery(t.title, searchQuery))
    .filter((t) => {
      const done = taskState(t.status) === "completed";
      // In the default view, hide items completed more than 8 hours ago.
      // The "Completed" filter always shows every completed item.
      if (!done || showCompleted) return true;
      return isRecentlyCompleted(t.completedAt);
    })
    .filter(
      (t) =>
        selectedFilters.length === 0 ||
        taskFilterValues(t).some((v) => selectedFilters.includes(v)),
    )
    .map((t, index) => ({ t, index }))
    .sort((a, b) => {
      const aDone = taskState(a.t.status) === "completed";
      const bDone = taskState(b.t.status) === "completed";
      if (aDone !== bDone) return aDone ? 1 : -1;
      const aUrgent = !aDone && a.t.priority === "urgent";
      const bUrgent = !bDone && b.t.priority === "urgent";
      if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ t }) => t);
  const accent = accentVar(widget.accent);

  return (
    <>
      <FilterChips
        options={TASK_FILTERS}
        selected={selectedFilters}
        onToggle={onToggleFilter}
        open={filtersOpen}
      />
      <ul className="space-y-2">
      {items.length === 0 && (
        <EmptyState
          text={searchQuery.trim() ? "No tasks match your search." : "No tasks yet. End a note with / to add one."}
        />
      )}
      {items.map((t) => {
        const done = taskState(t.status) === "completed";
        const isConfirming = confirming === t.id;
        const isScheduling = scheduling === t.id;
        const recurs = !!t.recurrence && t.recurrence !== "none";
        const isAlertActive = !done && isTaskAlertActive(t);
        const urgent = !done && t.priority === "urgent";
        return (
          <motion.li
            key={t.id}
            layout
            transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
            className="group relative flex min-h-6 items-start gap-2 rounded-lg pr-1 pl-1.5 transition-colors"
            style={{
              backgroundColor: isAlertActive
                ? `color-mix(in srgb, ${accent} 12%, transparent)`
                : "transparent",
            }}
            onClick={() => setTapped((v) => (v === t.id ? null : t.id))}
          >
            <button
              type="button"
              aria-label={done ? "Reopen task" : "Complete task"}
              onPointerDown={stop}
              onClick={(e) => {
                e.stopPropagation();
                toggleTask(widget.id, t.id);
              }}
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors"
              style={
                done
                  ? { backgroundColor: accent, borderColor: accent }
                  : { borderColor: accent, backgroundColor: "transparent" }
              }
            >
              {done && <Check className="size-2.5 text-white" strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1.5">
                <span
                  className={cn(
                    "min-w-0 flex-1 break-words text-[13px] leading-snug",
                    done && "text-muted-foreground line-through",
                  )}
                >
                  {highlightText(t.title, searchQuery)}
                </span>
                {urgent && (
                  <AlarmClock
                    className="mt-0.5 size-3 shrink-0"
                    style={{ color: accentVar("red") }}
                    aria-label="Urgent"
                  />
                )}
              </div>
              {(recurs || t.time) && !isScheduling && (
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {recurs ? RECURRENCE_LABELS[t.recurrence!] : ""}
                  {recurs && t.time ? " · " : ""}
                  {t.time ?? ""}
                </p>
              )}
              {isScheduling && (
                <TaskSchedulePanel
                  task={t}
                  accent={accent}
                  onChange={(patch) => updateTask(widget.id, t.id, patch)}
                  onDone={() => setScheduling(null)}
                />
              )}
            </div>
            <ItemActions revealed={tapped === t.id || isConfirming || isScheduling}>
              {isConfirming ? (
                <DeleteAction
                  label="Delete task"
                  confirming
                  onRequest={() => setConfirming(t.id)}
                  onCancel={() => setConfirming(null)}
                  onConfirm={() => {
                    setConfirming(null);
                    deleteTask(widget.id, t.id);
                  }}
                />
              ) : (
                <>
                  <MiniAction
                    label={t.priority === "urgent" ? "Unmark urgent" : "Mark urgent"}
                    onClick={() =>
                      updateTask(widget.id, t.id, {
                        priority: t.priority === "urgent" ? "normal" : "urgent",
                      })
                    }
                  >
                    <AlarmClock
                      className="size-3"
                      style={t.priority === "urgent" ? { color: accentVar("red") } : undefined}
                    />
                  </MiniAction>
                  <MiniAction label="Repeat & schedule task" onClick={() => setScheduling(t.id)}>
                    <Repeat className="size-3" />
                  </MiniAction>
                  <DeleteAction
                    label="Delete task"
                    confirming={false}
                    onRequest={() => setConfirming(t.id)}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => deleteTask(widget.id, t.id)}
                  />
                </>
              )}
            </ItemActions>
          </motion.li>
        );
      })}
      </ul>
    </>
  );
}

function RemindersContent({
  widget,
  filtersOpen,
  selectedFilters,
  onToggleFilter,
}: {
  widget: Widget;
  filtersOpen: boolean;
  selectedFilters: string[];
  onToggleFilter: (value: string) => void;
}) {
  const { updateReminder, setReminderStatus, deleteReminder, searchQuery } = useWorkspace();
  const [editing, setEditing] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Re-render every 30s so the "active alert" highlight appears the instant
  // the current time crosses a reminder's configured "Notify me" threshold.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (widget.content.kind !== "reminders") return null;
  const accent = accentVar(widget.accent);
  const showCompleted = selectedFilters.includes("completed");
  const items = widget.content.items
    .filter((r) => matchesQuery(r.title, searchQuery))
    .filter((r) => {
      const done = reminderState(r) === "completed";
      // In the default view, hide items completed more than 8 hours ago.
      // The "Completed" filter always shows every completed item.
      if (!done || showCompleted) return true;
      return isRecentlyCompleted(r.completedAt);
    })
    .filter(
      (r) =>
        selectedFilters.length === 0 ||
        reminderFilterValues(r).some((v) => selectedFilters.includes(v)),
    )
    .map((r, index) => ({ r, index }))
    .sort((a, b) => {
      const aDone = reminderState(a.r) === "completed";
      const bDone = reminderState(b.r) === "completed";
      if (aDone !== bDone) return aDone ? 1 : -1;
      const aFlagged = !aDone && a.r.flagged;
      const bFlagged = !bDone && b.r.flagged;
      if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ r }) => r);

  return (
    <>
      <FilterChips
        options={REMINDER_FILTERS}
        selected={selectedFilters}
        onToggle={onToggleFilter}
        open={filtersOpen}
      />
      <ul className="space-y-2.5">
      {items.length === 0 && (
        <EmptyState
          text={searchQuery.trim() ? "No reminders match your search." : "No reminders yet. End a note with * to add one."}
        />
      )}
      {items.map((r) => {
        const done = reminderState(r) === "completed";
        const when = splitWhen(r);
        const isEditing = editing === r.id;
        const isRescheduling = rescheduling === r.id;
        const isConfirming = confirming === r.id;
        const isAlertActive = !done && isReminderAlertActive(r);
        return (
          <motion.li
            key={r.id}
            layout
            transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
            className="group relative flex min-h-7 gap-2.5 rounded-lg pr-1 pl-1.5 transition-colors"
            style={{
              backgroundColor: isAlertActive
                ? `color-mix(in srgb, ${accent} 12%, transparent)`
                : "transparent",
            }}
            onClick={() => setTapped((v) => (v === r.id ? null : r.id))}
          >
            <button
              type="button"
              aria-label={done ? "Reopen reminder" : "Complete reminder"}
              onPointerDown={stop}
              onClick={(e) => {
                e.stopPropagation();
                setReminderStatus(widget.id, r.id, done ? "active" : "completed");
              }}
              className="mt-1 flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors"
              style={
                done
                  ? { backgroundColor: accent, borderColor: accent }
                  : { borderColor: accent, backgroundColor: "transparent" }
              }
            >
              {done && <Check className="size-2 text-white" strokeWidth={3} />}
            </button>

            <div className="min-w-0 flex-1 py-0.5">
              {isEditing ? (
                <div className="space-y-1.5" onClick={stop} onPointerDown={stop}>
                  <input
                    value={r.title}
                    onChange={(e) => updateReminder(widget.id, r.id, { title: e.target.value })}
                    className="w-full rounded-lg bg-surface-2 px-2 py-1 text-[13px] outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(null);
                    }}
                    className="rounded-full px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:opacity-90"
                    style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, var(--surface-2))` }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-1.5">
                  <p
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(r.id);
                    }}
                    className={cn(
                      "min-w-0 flex-1 cursor-pointer truncate text-[13px] leading-snug",
                      done && "text-muted-foreground line-through",
                    )}
                  >
                    {highlightText(r.title, searchQuery)}
                  </p>
                  {r.flagged && (
                    <Flag
                      className="mt-0.5 size-3 shrink-0 fill-current"
                      style={{ color: accentVar("red") }}
                      aria-label="Flagged"
                    />
                  )}
                </div>
              )}

              {isRescheduling ? (
                <div className="mt-1.5 space-y-1.5" onClick={stop} onPointerDown={stop}>
                  <div className="flex flex-col gap-1.5">
                    <DateField
                      size="sm"
                      value={when.date}
                      onChange={(iso) => updateReminder(widget.id, r.id, { date: iso })}
                      placeholder="Pick a date"
                      aria-label="Reminder date"
                    />
                    <TimeField
                      value={when.time}
                      onChange={(t) => updateReminder(widget.id, r.id, { time: t })}
                    />
                  </div>

                  <Select
                    value={String(r.notifyMinutesBefore ?? DEFAULT_NOTIFY_MINUTES)}
                    onValueChange={(v) =>
                      updateReminder(widget.id, r.id, { notifyMinutesBefore: Number(v) })
                    }
                  >
                    <SelectTrigger
                      aria-label="Notify me"
                      className="h-auto w-full rounded-xl border-border bg-surface px-2 py-1 text-[11px] shadow-none focus:ring-0 focus-visible:border-ring"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {NOTIFY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)} className="text-[12px]">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRescheduling(null);
                    }}
                    className="rounded-full px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:opacity-90"
                    style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, var(--surface-2))` }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                formatReminderWhen(when) && (
                  <p
                    onClick={(e) => {
                      e.stopPropagation();
                      setRescheduling(r.id);
                    }}
                    className="cursor-pointer truncate font-mono text-[11px]"
                    style={{ color: `color-mix(in srgb, ${accent} 70%, var(--muted-foreground))` }}
                  >
                    {formatReminderWhen(when)}
                  </p>
                )
              )}
            </div>

            <ItemActions
              revealed={tapped === r.id || isEditing || isRescheduling || isConfirming}
            >
              {isConfirming ? (
                <DeleteAction
                  label="Delete reminder"
                  confirming
                  onRequest={() => setConfirming(r.id)}
                  onCancel={() => setConfirming(null)}
                  onConfirm={() => {
                    setConfirming(null);
                    deleteReminder(widget.id, r.id);
                  }}
                />
              ) : (
                <>
                  <MiniAction
                    label={r.flagged ? "Unflag reminder" : "Flag reminder"}
                    onClick={() => updateReminder(widget.id, r.id, { flagged: !r.flagged })}
                  >
                    <Flag
                      className={cn("size-3", r.flagged && "fill-current")}
                      style={r.flagged ? { color: accentVar("red") } : undefined}
                    />
                  </MiniAction>
                  <MiniAction label="Reschedule reminder" onClick={() => setRescheduling(r.id)}>
                    <Clock className="size-3" />
                  </MiniAction>
                  <DeleteAction
                    label="Delete reminder"
                    confirming={false}
                    onRequest={() => setConfirming(r.id)}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => deleteReminder(widget.id, r.id)}
                  />

                </>
              )}
            </ItemActions>
          </motion.li>
        );
      })}
      </ul>
    </>
  );
}

function ContactsContent({
  widget,
  filtersOpen,
  selectedFilters,
  onToggleFilter,
}: {
  widget: Widget;
  filtersOpen: boolean;
  selectedFilters: string[];
  onToggleFilter: (value: string) => void;
}) {
  const { updateContact, deleteContact, searchQuery } = useWorkspace();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);
  if (widget.content.kind !== "contacts") return null;

  const field =
    "w-full rounded-lg bg-surface px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-ring";

  const visible = widget.content.items
    .filter((p) =>
      matchesQuery([p.name, p.company, p.email, p.phone].filter(Boolean).join(" "), searchQuery),
    )
    .filter((p) => {
      if (selectedFilters.length === 0) return true;
      if (selectedFilters.includes("favorite")) return !!p.favorite;
      return selectedFilters.includes(contactFilterValue(p));
    })
    .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite));

  return (
    <>
      <FilterChips
        options={CONTACT_FILTERS}
        selected={selectedFilters}
        onToggle={onToggleFilter}
        open={filtersOpen}
      />
      <ul className="grid grid-cols-1 gap-2.5 @[22rem]:grid-cols-2">
      {visible.length === 0 && (
        <EmptyState
          text={searchQuery.trim() ? "No contacts match your search." : "No contacts added yet. End a note with # to add one."}
        />
      )}
      {visible.map((p) => {
        const isEditing = editing === p.id;
        const isConfirming = confirming === p.id;
        const category = contactFilterValue(p);
        const CategoryIcon =
          category === "hotel" ? Building2 : category === "agent" ? Users : UserRound;
        const categoryAccent =
          category === "hotel" ? "blue" : category === "agent" ? "purple" : "neutral";
        return (
          <li
            key={p.id}
            className="group relative min-w-0 rounded-xl bg-surface-2 px-3 py-2"
            onClick={() => setTapped((v) => (v === p.id ? null : p.id))}
          >
            <div className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <div className="space-y-1" onClick={stop} onPointerDown={stop}>
                    {(
                      [
                        ["name", "Name"],
                        ["phone", "Phone"],
                      ] as const
                    ).map(([key, label]) => (
                      <input
                        key={key}
                        value={p[key] ?? ""}
                        placeholder={label}
                        aria-label={label}
                        onChange={(e) => updateContact(widget.id, p.id, { [key]: e.target.value })}
                        className={field}
                      />
                    ))}
                    <Select
                      value={category}
                      onValueChange={(v) =>
                        updateContact(widget.id, p.id, { category: v as ContactCategory })
                      }
                    >
                      <SelectTrigger
                        aria-label="Category"
                        className="h-auto w-full rounded-lg border-border bg-surface px-2 py-1 text-[12px] shadow-none focus:ring-0 focus-visible:border-ring"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="hotel" className="text-[12px]">
                          Hotel
                        </SelectItem>
                        <SelectItem value="agent" className="text-[12px]">
                          Agent
                        </SelectItem>
                        <SelectItem value="client" className="text-[12px]">
                          Client
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(null);
                      }}
                      className="label-xs hover:text-foreground"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 pr-6">
                      <CategoryIcon
                        className="size-3 shrink-0"
                        style={{ color: accentVar(categoryAccent) }}
                        aria-label={category}
                      />
                      <p className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {highlightText(p.name, searchQuery)}
                      </p>
                    </div>
                    {p.phone && (
                      <p className="flex items-center gap-1.5 truncate font-mono text-[12px] text-entity-phone">
                        <span className="inline-flex w-3 shrink-0 items-center justify-center">
                          {p.favorite && (
                            <Star
                              className="size-3 fill-current"
                              style={{ color: accentVar("yellow") }}
                              aria-label="Favorite"
                            />
                          )}
                        </span>
                        {highlightText(p.phone, searchQuery)}
                      </p>
                    )}
                  </>
                )}
              </div>

              <ItemActions revealed={tapped === p.id || isEditing || isConfirming}>
                {isConfirming ? (
                  <DeleteAction
                    label="Delete contact"
                    confirming
                    onRequest={() => setConfirming(p.id)}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => {
                      setConfirming(null);
                      deleteContact(widget.id, p.id);
                    }}
                  />
                ) : (
                  <>
                    <MiniAction
                      label={p.favorite ? "Unfavorite contact" : "Favorite contact"}
                      onClick={() => updateContact(widget.id, p.id, { favorite: !p.favorite })}
                    >
                      <Star
                        className={cn("size-3", p.favorite && "fill-current")}
                        style={p.favorite ? { color: accentVar("yellow") } : undefined}
                      />
                    </MiniAction>
                    <MiniAction label="Edit contact" onClick={() => setEditing(p.id)}>
                      <Pencil className="size-3" />
                    </MiniAction>
                    <DeleteAction
                      label="Delete contact"
                      confirming={false}
                      onRequest={() => setConfirming(p.id)}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() => deleteContact(widget.id, p.id)}
                    />
                  </>
                )}
              </ItemActions>
            </div>
          </li>
        );
      })}
      </ul>
    </>
  );
}

/**
 * In-place rich-text editor for a sticky note. Uncontrolled (innerHTML is set
 * once on mount) so typing never resets the caret; changes stream to the
 * store on every input.
 */
function StickyNoteEditor({ widgetId, note }: { widgetId: string; note: NoteRefItem }) {
  const { updateNoteContent } = useWorkspace();
  return (
    <div
      ref={(el) => {
        if (el && !el.dataset["init"]) {
          el.innerHTML = note.text;
          el.dataset["init"] = "1";
        }
      }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      aria-label="Edit sticky note"
      onInput={(e) => updateNoteContent(widgetId, note.id, e.currentTarget.innerHTML)}
      onPointerDown={stop}
      onDragStart={(e) => e.preventDefault()}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        const cell = target.closest("td, th") as HTMLElement | null;
        if (!cell) return;
        e.preventDefault();
        const text = cell.textContent ?? "";
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).catch(() => {});
        }
        cell.style.transition = "background-color 200ms ease";
        cell.style.backgroundColor = "rgba(100, 116, 139, 0.35)";
        window.setTimeout(() => {
          cell.style.backgroundColor = "";
        }, 300);
      }}
      className="notes-rich min-h-5 min-w-0 cursor-text break-words rounded-md text-[13px] leading-snug outline-none transition-colors focus:bg-surface/50"
    />
  );
}

function NotesContent({ widget }: { widget: Widget }) {
  const { convertNoteToSticky, deleteNote, toggleNotePin, editNoteInEditor, searchQuery } =
    useWorkspace();
  const [tapped, setTapped] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  if (widget.content.kind !== "notes") return null;

  // Sticky notes render as a plain pastel note with click-to-edit content.
  if (widget.type === "sticky")
    return (
      <div className="space-y-2">
        {widget.content.items.map((n) => (
          <StickyNoteEditor key={n.id} widgetId={widget.id} note={n} />
        ))}
      </div>
    );

  const ordered = [...widget.content.items]
    .filter((n) => matchesQuery(n.text.replace(/<[^>]+>/g, " "), searchQuery))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  if (ordered.length === 0)
    return (
      <p className="text-[12px] text-muted-foreground">
        {searchQuery.trim()
          ? "No notes match your search."
          : "Write in the NOTES editor and press save to add a note here."}
      </p>
    );

  return (
    <ul className="space-y-2">
      {ordered.map((n) => {
        const isConfirming = confirming === n.id;
        return (
          <li
            key={n.id}
            className="group relative flex min-w-0 items-start gap-2 rounded-xl bg-surface-2 px-3 py-2"
            style={{ backgroundColor: n.pinned ? tintVar(widget.accent) : undefined }}
            onClick={() => setTapped((v) => (v === n.id ? null : n.id))}
          >
            <span
              className="notes-rich min-w-0 flex-1 break-words text-[13px] leading-snug"
              dangerouslySetInnerHTML={{
                __html: highlightHtml(sanitizeHtml(n.text), searchQuery),
              }}
            />
            <ItemActions revealed={tapped === n.id || isConfirming}>
              {isConfirming ? (
                <DeleteAction
                  label="Delete note"
                  confirming
                  onRequest={() => setConfirming(n.id)}
                  onCancel={() => setConfirming(null)}
                  onConfirm={() => {
                    setConfirming(null);
                    deleteNote(widget.id, n.id);
                  }}
                />
              ) : (
                <>
                  <MiniAction
                    label={n.pinned ? "Unpin note" : "Pin note"}
                    onClick={() => toggleNotePin(widget.id, n.id)}
                  >
                    <Pin className="size-3" />
                  </MiniAction>
                  <MiniAction
                    label="Edit note"
                    onClick={() => editNoteInEditor(widget.id, n.id)}
                  >
                    <Pencil className="size-3" />
                  </MiniAction>
                  <MiniAction
                    label="Convert to sticky note"
                    onClick={() => convertNoteToSticky(widget.id, n.id)}
                  >
                    <ArrowUpRight className="size-3" />
                  </MiniAction>
                  <DeleteAction
                    label="Delete note"
                    confirming={false}
                    onRequest={() => setConfirming(n.id)}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => deleteNote(widget.id, n.id)}
                  />
                </>
              )}
            </ItemActions>
          </li>
        );
      })}
    </ul>
  );
}


export function WidgetContent({
  widget,
  filtersOpen = false,
  selectedFilters = [],
  onToggleFilter = () => {},
}: {
  widget: Widget;
  filtersOpen?: boolean;
  selectedFilters?: string[];
  onToggleFilter?: (value: string) => void;
}) {
  const c = widget.content;

  if (c.kind === "reminders")
    return (
      <RemindersContent
        widget={widget}
        filtersOpen={filtersOpen}
        selectedFilters={selectedFilters}
        onToggleFilter={onToggleFilter}
      />
    );
  if (c.kind === "tasks")
    return (
      <TasksContent
        widget={widget}
        filtersOpen={filtersOpen}
        selectedFilters={selectedFilters}
        onToggleFilter={onToggleFilter}
      />
    );
  if (c.kind === "contacts")
    return (
      <ContactsContent
        widget={widget}
        filtersOpen={filtersOpen}
        selectedFilters={selectedFilters}
        onToggleFilter={onToggleFilter}
      />
    );
  

  return <NotesContent widget={widget} />;
}

/** Widget kinds whose header icon toggles extra controls (filters). */
export function widgetSupportsHeaderToggle(kind: Widget["content"]["kind"]): boolean {
  return kind === "reminders" || kind === "tasks" || kind === "contacts";
}

