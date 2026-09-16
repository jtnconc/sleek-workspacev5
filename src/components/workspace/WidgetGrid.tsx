import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type MotionStyle } from "framer-motion";
import { useWorkspace, isSizeLocked } from "@/workspace/store";
import type { Widget, WidgetSize } from "@/workspace/types";
import { cn } from "@/lib/utils";
import { reminderAlertPhase, type AlertPhase } from "@/lib/reminder-alert";
import { taskAlertPhase } from "@/lib/task-schedule";
import { WidgetContent, widgetSupportsHeaderToggle, taskState, reminderState } from "./WidgetContent";
import { SizeControl } from "./SizeControl";
import { accentVar, tintVar } from "./AccentControl";
import { WidgetCustomizer } from "./WidgetCustomizer";
import { widgetIcon } from "./widget-icons";

/** Fixed height (px) of a single grid track row. Cards span an exact number
 * of these rows (1 or 2) and never grow past their span — inner content that
 * overflows scrolls instead of stretching the row/dashboard. */
const ROW_UNIT = 150;
/** Vertical gap (px) between grid rows; must match the `gap-3` utility (0.75rem). */
const ROW_GAP = 12;
const MINIMIZED_BUTTON_SIZE = 36;
const MINIMIZED_GAP = 8;
const BASE_WIDGET_TYPES = new Set(["reminders", "contacts", "information", "tasks", "notes"]);

/** Fixed outer height (px) for a card spanning `h` grid rows, including the
 * inter-row gap that a 2-row card absorbs. */
const cardHeight = (h: number) => h * ROW_UNIT + (h - 1) * ROW_GAP;


/** Static class lookups — Tailwind cannot generate classes from runtime
 * template strings, so every span variant is spelled out here. */
const COL_SPAN: Record<number, string> = {
  1: "col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
};
const ROW_SPAN: Record<number, string> = {
  1: "row-span-1",
  2: "row-span-2",
  3: "row-span-3",
  4: "row-span-4",
};

/** Max grid units a card may span on either axis. */
const MAX_SPAN = 4;
const clampSpan = (n: number) => Math.min(MAX_SPAN, Math.max(1, Math.round(n)));

const spanClass = (w: Widget) =>
  cn(COL_SPAN[clampSpan(w.width)] ?? "col-span-1", ROW_SPAN[clampSpan(w.height)] ?? "row-span-1");

/** Worst-case alert phase across all of a reminders/tasks widget's
 * (non-completed) items: "due" wins over "pre" wins over "none". */
function widgetAlertPhase(w: Widget, now: Date): AlertPhase {
  if (w.content.kind === "reminders") {
    let phase: AlertPhase = "none";
    for (const r of w.content.items) {
      if (reminderState(r) === "completed" || reminderState(r) === "archived") continue;
      const p = reminderAlertPhase(r, now);
      if (p === "due") return "due";
      if (p === "pre") phase = "pre";
    }
    return phase;
  }
  if (w.content.kind === "tasks") {
    let phase: AlertPhase = "none";
    for (const t of w.content.items) {
      if (taskState(t.status) === "completed") continue;
      const p = taskAlertPhase(t, now);
      if (p === "due") return "due";
      if (p === "pre") phase = "pre";
    }
    return phase;
  }
  return "none";
}


export function WidgetGrid() {
  const {
    widgets,
    mode,
    activeWidget,
    openWidget,
    setWidgetSize,
    setWidgetDimensions,
    setWidgetAccent,
    setWidgetIcon,
    setWidgetTint,
    renameWidget,
    returnStickyToNotes,
    reorderWidgets,
    toggleWidgetSizeLock,
    pulses,
    clearPulse,
    searchPulseId,
    searchPulseToken,
    clearSearchPulse,
  } = useWorkspace();
  const ordered = [...widgets].sort((a, b) => a.position - b.position);
  const minimized = mode === "tool";

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [lockedHeights, setLockedHeights] = useState<Record<string, number>>({});
  const [filtersOpenId, setFiltersOpenId] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const dragged = useRef<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const gridRef = useRef<HTMLDivElement | null>(null);
  const minimizedRowRef = useRef<HTMLDivElement | null>(null);
  const minimizedMeasureRef = useRef<HTMLDivElement | null>(null);
  const [minimizedLayout, setMinimizedLayout] = useState<"text" | "icon">("icon");
  const [visibleExtraCount, setVisibleExtraCount] = useState(0);

  const baseWidgets = ordered.filter((widget) => BASE_WIDGET_TYPES.has(widget.type));
  const extraWidgets = ordered.filter((widget) => !BASE_WIDGET_TYPES.has(widget.type));

  useLayoutEffect(() => {
    if (!minimized) return;
    const row = minimizedRowRef.current;
    const measure = minimizedMeasureRef.current;
    if (!row || !measure) return;

    const recalculate = () => {
      const availableWidth = Math.max(0, row.clientWidth - 8);
      const requiredTextWidth = measure.getBoundingClientRect().width;
      if (requiredTextWidth <= availableWidth) {
        setMinimizedLayout("text");
        setVisibleExtraCount(extraWidgets.length);
        return;
      }

      const circleCapacity = Math.max(
        0,
        Math.floor((availableWidth + MINIMIZED_GAP) / (MINIMIZED_BUTTON_SIZE + MINIMIZED_GAP)),
      );
      setMinimizedLayout("icon");
      setVisibleExtraCount(Math.max(0, Math.min(extraWidgets.length, circleCapacity - baseWidgets.length)));
    };

    const observer = new ResizeObserver(recalculate);
    observer.observe(row);
    recalculate();
    const frame = requestAnimationFrame(recalculate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [minimized, ordered.map((widget) => `${widget.id}:${widget.title}`).join("|")]);

  const [alertTick, setAlertTick] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAlertTick(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  /** Live grid-snapped resize preview: null unless a handle is being dragged. */
  const [resize, setResize] = useState<{
    id: string;
    width: number;
    height: number;
    left: number;
    top: number;
  } | null>(null);

  const handleToggleLock = (id: string) => {
    const el = sectionRefs.current.get(id);
    const target = widgets.find((w) => w.id === id);
    const isCurrentlyLocked = target ? isSizeLocked(target) : false;
    if (!isCurrentlyLocked && el) {
      setLockedHeights((prev) => ({ ...prev, [id]: el.getBoundingClientRect().height }));
    }
    toggleWidgetSizeLock(id);
  };

  /** Begin a drag-resize: snaps to whole columns / rows while moving and
   * commits the resulting spans to the store on release. */
  const startResize = (e: React.PointerEvent, w: Widget) => {
    e.preventDefault();
    e.stopPropagation();
    const section = sectionRefs.current.get(w.id);
    const grid = gridRef.current;
    if (!section || !grid) return;
    const rect = section.getBoundingClientRect();
    const columns = window.matchMedia("(min-width: 640px)").matches ? 4 : 2;
    const colUnit = (grid.getBoundingClientRect().width - (columns - 1) * ROW_GAP) / columns;
    const startX = e.clientX;
    const startY = e.clientY;
    const maxCols = columns;
    let next = { width: clampSpan(w.width), height: clampSpan(w.height) };

    const measure = (ev: PointerEvent) => {
      const width = Math.min(
        maxCols,
        Math.max(1, Math.round((rect.width + (ev.clientX - startX) + ROW_GAP) / (colUnit + ROW_GAP))),
      );
      const height = Math.min(
        MAX_SPAN,
        Math.max(
          1,
          Math.round((rect.height + (ev.clientY - startY) + ROW_GAP) / (ROW_UNIT + ROW_GAP)),
        ),
      );
      next = { width, height };
      setResize({ id: w.id, width, height, left: rect.left, top: rect.top });
    };

    const move = (ev: PointerEvent) => measure(ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setResize(null);
      setWidgetDimensions(w.id, next.width, next.height);
    };
    setResize({ id: w.id, width: next.width, height: next.height, left: rect.left, top: rect.top });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleToggleFilterValue = (widgetId: string, value: string) => {
    setSelectedFilters((prev) => {
      const current = prev[widgetId] ?? [];
      const next = current.includes(value) ? [] : [value];
      return { ...prev, [widgetId]: next };
    });
  };

  useEffect(() => {
    if (!settling) return;
    const t = setTimeout(() => setSettling(null), 340);
    return () => clearTimeout(t);
  }, [settling]);

  // Re-render every 30s so the reminder "due" badge appears the instant the
  // current time crosses each reminder's configured alert threshold.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Auto-clear the temporary "+n" notification badges.
  const pulseIds = Object.keys(pulses);
  useEffect(() => {
    if (pulseIds.length === 0) return;
    const timers = pulseIds.map((id) => setTimeout(() => clearPulse(id), 4000));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseIds.join(","), clearPulse]);

  // Smoothly scroll any newly-active card into the center of the viewport so
  // search results (or any other off-screen activation) are immediately visible.
  useEffect(() => {
    if (!activeWidget) return;
    const el = sectionRefs.current.get(activeWidget);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeWidget]);

  // Brief shake emphasis after navigating to a card via search; auto-clears.
  // `clearSearchPulse` gets a fresh identity on every store update, so it is
  // held in a ref — otherwise unrelated state changes would restart (or, when
  // combined with a re-mounted grid, cut short) the timer that owns the class.
  const clearSearchPulseRef = useRef(clearSearchPulse);
  clearSearchPulseRef.current = clearSearchPulse;
  useEffect(() => {
    if (!searchPulseId) return;
    // Restart the animation from frame 0 even when the class was already on
    // the element (repeat search hits on the same card).
    const el = sectionRefs.current.get(searchPulseId);
    el?.getAnimations().forEach((a) => {
      if ("animationName" in a && (a as CSSAnimation).animationName === "widget-shake") {
        a.currentTime = 0;
        a.play();
      }
    });
    const t = setTimeout(() => clearSearchPulseRef.current(), 520);
    return () => clearTimeout(t);
  }, [searchPulseId, searchPulseToken]);

  const activate = (id: string) => {
    openWidget(id);
  };

  const activateFromDock = (id: string) => {
    setSettling(id);
    openWidget(id, { fromSearch: true });
  };

  if (minimized)
    return (
      <div ref={minimizedRowRef} className="relative w-full min-w-0 overflow-visible p-1 pt-2">
        <div
          ref={minimizedMeasureRef}
          aria-hidden="true"
          className="pointer-events-none invisible fixed -left-[10000px] top-0 flex w-max flex-row flex-nowrap gap-2 whitespace-nowrap"
        >
          {ordered.map((w) => {
            const Icon = widgetIcon(w.type, w.icon);
            return (
              <span
                key={w.id}
                className="flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2"
              >
                <Icon size={20} />
                <span className="label-xs">{w.title}</span>
              </span>
            );
          })}
        </div>

        <div className="flex w-full min-w-0 flex-row flex-nowrap items-center gap-2 transition-[gap] duration-300">
          <AnimatePresence initial={false} mode="popLayout">
            {(minimizedLayout === "text"
              ? ordered
              : [...baseWidgets, ...extraWidgets.slice(0, visibleExtraCount)]
            ).map((w) => {
              const Icon = widgetIcon(w.type, w.icon);
              const pulse = pulses[w.id];
              const alertPhase = widgetAlertPhase(w, alertTick);

              return (
                <motion.button
                  key={w.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => activateFromDock(w.id)}
                  aria-label={minimizedLayout === "icon" ? w.title : undefined}
                  title={minimizedLayout === "icon" ? w.title : undefined}
                  className={cn(
                    "group relative flex h-9 items-center justify-center overflow-visible rounded-full border border-border bg-surface shadow-desk transition-[width,padding,gap,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lift",
                    minimizedLayout === "text"
                      ? "w-auto shrink-0 gap-2 px-3.5"
                      : "flex-1 basis-0 gap-0 px-0",
                    pulse && "widget-glow",
                    alertPhase === "due" && "pill-alert-pulse",
                  )}
                  style={{
                    ...(w.type === "sticky" ? { backgroundColor: tintVar(w.tint) } : {}),
                    ...(alertPhase === "due" ? { "--pulse-color": accentVar(w.accent) } : {}),
                  } as MotionStyle}
                >
                  <Icon
                    size={20}
                    className={cn(
                      "shrink-0 text-primary transition-colors",
                      alertPhase === "pre" && "due-clock-inline",
                    )}
                  />
                  <span
                    className={cn(
                      "label-xs overflow-hidden transition-[max-width,opacity] duration-300 group-hover:text-foreground",
                      minimizedLayout === "text" ? "max-w-40 opacity-100" : "max-w-0 opacity-0",
                    )}
                  >
                    {w.title}
                  </span>
                  {pulse ? (
                    <span className="absolute right-0 top-0 z-10 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary px-1.5 py-[1px] text-[10px] font-semibold text-primary-foreground">
                      +{pulse}
                    </span>
                  ) : null}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    );

  const handleEnter = (targetId: string) => {
    const id = dragged.current;
    if (!id || id === targetId) return;
    setOverId(targetId);
    const target = ordered.findIndex((x) => x.id === targetId);
    if (target >= 0) reorderWidgets(id, target);
  };

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      style={{ gridAutoRows: `${ROW_UNIT}px` }}
    >
      {ordered.map((w) => {
        const Icon = widgetIcon(w.type, w.icon);
        const active = activeWidget === w.id;
        const isDragging = dragId === w.id;
        const accent = accentVar(w.accent);
        const isSticky = w.type === "sticky";
        const isCustomizing = customizing === w.id && isSticky;
        const pulse = pulses[w.id];
        const isLocked = isSizeLocked(w);
        const isResizing = resize?.id === w.id;
        const lockedHeight = lockedHeights[w.id];
        return (
          <section
            key={w.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(w.id, el);
              else sectionRefs.current.delete(w.id);
            }}
            draggable={!isResizing}
            onDragStart={(e) => {
              dragged.current = w.id;
              setDragId(w.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", w.id);
            }}
            onDragEnd={() => {
              dragged.current = null;
              setDragId(null);
              setOverId(null);
            }}
            onDragEnter={() => handleEnter(w.id)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              dragged.current = null;
              setDragId(null);
              setOverId(null);
            }}
            onClick={() => activate(w.id)}
            style={{
              ...(isSticky ? { backgroundColor: tintVar(w.tint) } : {}),
              ...(active
                ? { borderColor: `color-mix(in oklch, ${accent} 35%, transparent)` }
                : {}),
              // Rigid grid unit: the card is locked to the exact height of its
              // row span so content can never alter the track height. Overflow
              // is handled by the inner scroll container below.
              height: isLocked && lockedHeight ? `${lockedHeight}px` : `${cardHeight(w.height)}px`,
            }}
            className={cn(
              "desk-panel group/card relative flex cursor-grab flex-col overflow-hidden p-4 transition-all duration-300 active:cursor-grabbing",
              spanClass(w),
              active ? "shadow-lift" : "hover:shadow-lift",
              isDragging && "scale-[0.98] opacity-40",
              overId === w.id && !isDragging && "ring-2 ring-ring/60",
              settling === w.id && "widget-settle",
              pulse && "widget-glow",
              searchPulseId === w.id && "widget-shake",
            )}
          >
            {pulse ? (
              <span className="absolute right-2 top-2 z-10 rounded-full bg-primary px-1.5 py-[1px] text-[10px] font-semibold text-primary-foreground">
                +{pulse}
              </span>
            ) : null}
            <header className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {isSticky ? (
                  <button
                    type="button"
                    aria-label="Customize sticky note"
                    title="Customize sticky note"
                    onPointerDown={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomizing((v) => (v === w.id ? null : w.id));
                    }}
                    className="flex size-5 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-secondary"
                  >
                    <Icon size={15} className="text-primary" />
                  </button>
                ) : widgetSupportsHeaderToggle(w.content.kind) ? (
                  <button
                    type="button"
                    aria-label="Toggle controls"
                    aria-pressed={filtersOpenId === w.id}
                    title="Controls"

                    onPointerDown={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiltersOpenId((v) => (v === w.id ? null : w.id));
                    }}
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-secondary",
                      filtersOpenId === w.id && "bg-secondary",
                    )}
                  >
                    <Icon size={15} className="text-primary" />
                  </button>
                ) : (
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    <Icon size={15} className="text-primary" />
                  </span>
                )}
                {isSticky ? (
                  editingTitle === w.id ? (
                    <input
                      autoFocus
                      defaultValue={w.title}
                      aria-label="Sticky note title"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onDragStart={(e) => e.preventDefault()}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) renameWidget(w.id, v);
                        setEditingTitle(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingTitle(null);
                      }}
                      className="label-xs w-28 min-w-0 rounded-md bg-surface px-1.5 py-0.5 outline-none ring-1 ring-ring/50"
                    />
                  ) : (
                    <button
                      type="button"
                      title="Rename sticky note"
                      onPointerDown={(e) => e.stopPropagation()}
                      onDragStart={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTitle(w.id);
                      }}
                      className="label-xs truncate rounded-md px-1 transition-colors hover:bg-secondary/70"
                    >
                      {w.title}
                    </button>
                  )
                ) : (
                  <h3 className="label-xs truncate">{w.title}</h3>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <SizeControl
                  value={`${w.width}x${w.height}` as WidgetSize}
                  onChange={(s) => setWidgetSize(w.id, s)}
                  locked={isLocked}
                  onToggleLock={() => handleToggleLock(w.id)}
                  onReturn={isSticky ? () => returnStickyToNotes(w.id) : undefined}
                  returnLabel={
                    w.content.kind === "information"
                      ? "Return detail to Information list"
                      : "Return note to Notes list"
                  }
                />
              </div>
            </header>
            {isCustomizing && (
              <WidgetCustomizer
                icon={w.icon}
                accent={w.accent}
                tint={w.tint}
                onIcon={(icon) => setWidgetIcon(w.id, icon)}
                onAccent={(a) => setWidgetAccent(w.id, a)}
                onTint={(t) => setWidgetTint(w.id, t)}
              />
            )}
            {!isLocked ? (
              <button
                type="button"
                aria-label="Resize card"
                title="Drag to resize"
                onPointerDown={(e) => startResize(e, w)}
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e) => e.preventDefault()}
                className={cn(
                  "absolute bottom-0.5 right-0.5 z-10 flex size-4 cursor-nwse-resize items-center justify-center rounded-[4px] text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/card:opacity-100",
                  isResizing && "opacity-100",
                )}
              >
                <svg viewBox="0 0 10 10" className="size-[9px]" aria-hidden="true">
                  <path
                    d="M9 1 1 9M9 5 5 9M9 9 9 9"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
            ) : null}
            <div className="hover-scroll @container min-h-0 flex-1 overflow-y-auto">
              <WidgetContent
                widget={w}
                filtersOpen={filtersOpenId === w.id}
                selectedFilters={selectedFilters[w.id] ?? []}
                onToggleFilter={(value) => handleToggleFilterValue(w.id, value)}
              />
            </div>
          </section>
        );
      })}
      {resize
        ? (() => {
            const grid = gridRef.current;
            const columns = typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches ? 4 : 2;
            const colUnit = grid
              ? (grid.getBoundingClientRect().width - (columns - 1) * ROW_GAP) / columns
              : 0;
            return (
              <div
                aria-hidden="true"
                className="pointer-events-none fixed z-50 rounded-xl border-2 border-dashed border-ring/70 bg-ring/5"
                style={{
                  left: resize.left,
                  top: resize.top,
                  width: resize.width * colUnit + (resize.width - 1) * ROW_GAP,
                  height: cardHeight(resize.height),
                }}
              />
            );
          })()
        : null}
    </div>
  );
}
