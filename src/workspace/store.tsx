import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,

} from "react";
import { quoteNumber, todayISO } from "@/lib/quote-model";
import { getHotel } from "@/lib/hotels";
import { isTaskDueToday } from "@/lib/task-schedule";
import type {
  CallLogEntry,
  ContactItem,
  HotelDetails,
  
  NoteVersion,
  QuoteDoc,
  ItemStatus,
  ReminderItem,
  TaskItem,
  ToolId,
  Widget,
  WidgetAccent,
  WidgetIconName,
  WidgetSize,
  WidgetType,
  WidgetSpan,
  WorkspaceMode,
} from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

/** How long the tab must stay hidden (minimized / switched away) before
 * returning to the app snaps the active view back to the Notes tool. Adjust
 * this single constant to change the inactivity window. */
const INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000;

const DEFAULT_NOTE = "";

/** Clamp any candidate span to the 1..4 grid units the layout supports. */
const clampSpan = (n: number): WidgetSpan =>
  (Math.min(4, Math.max(1, Math.round(n))) as WidgetSpan);

/** Size lock state, tolerating the legacy `heightLocked` persisted field. */
export const isSizeLocked = (w: { sizeLocked?: boolean; heightLocked?: boolean }): boolean =>
  w.sizeLocked ?? w.heightLocked ?? false;

const sizeOf = (w: WidgetSpan, h: WidgetSpan): WidgetSize => `${w}x${h}` as WidgetSize;

const DEFAULT_WIDGETS: Widget[] = [
  {
    id: "w-reminders",
    type: "reminders",
    title: "Reminders",
    position: 0,
    width: 1,
    height: 2,
    display: "minimized",
    accent: "orange",
    content: {
      kind: "reminders",
      items: [],
    },
  },
  {
    id: "w-contacts",
    type: "contacts",
    title: "Contacts",
    position: 1,
    width: 2,
    height: 1,
    display: "minimized",
    accent: "blue",
    content: {
      kind: "contacts",
      items: [],
    },
  },
  {
    id: "w-tasks",
    type: "tasks",
    title: "Tasks",
    position: 3,
    width: 1,
    height: 1,
    display: "minimized",
    accent: "green",
    content: {
      kind: "tasks",
      items: [],
    },
  },
  {
    id: "w-notes",
    type: "notes",
    title: "Notes",
    position: 4,
    width: 2,
    height: 1,
    display: "minimized",
    accent: "purple",
    content: {
      kind: "notes",
      items: [],
    },
  },
];

const DEFAULT_QUOTE = (): QuoteDoc => {
  const today = todayISO();
  const hotel = getHotel("residence-inn");
  return {
    id: `q-${uid()}`,
    hotelId: hotel.id,
    language: "es",
    issueDate: today,
    arrival: today,
    departure: today,
    nights: 1,
    nightsOverride: false,
    salutation: "Estimado",
    recipient: "",
    company: "",
    guest: "",
    intro: hotel.es.intro,
    description: "",
    descriptionEdited: false,
    status: "new",
    itbmsRate: hotel.taxRate,
    includedServices: [...hotel.es.includedServices],
    hotelInfo: hotel.es.hotelInfo,
    checkIn: hotel.checkIn,
    checkOut: hotel.checkOut,
    signature: hotel.es.signature,
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: uid(),
        quantity: 1,
        roomType: hotel.roomTypes[0] ?? "",
        accommodation: "Single",
        ratePerNight: 0,
        itbms: true,
      },
    ],
  };
};

/** Quote documents from earlier versions of the app lack the current fields. */
const isValidQuote = (q: unknown): q is QuoteDoc => {
  const doc = q as QuoteDoc | undefined;
  return (
    !!doc &&
    Array.isArray(doc.items) &&
    typeof doc.itbmsRate === "number" &&
    (doc.language === "es" || doc.language === "en")
  );
};


interface WorkspaceState {
  mode: WorkspaceMode;
  activeTool: ToolId;
  activeWidget: string | null;
  widgets: Widget[];
  noteText: string;
  noteHistory: NoteVersion[];
  /** Completed calls, isolated from general notes. Powers the Call History
   * side panel in the Notes tool. */
  callHistory: CallLogEntry[];
  quote: QuoteDoc;
  quoteHistory: QuoteDoc[];
  /** Uploaded hotel logos (data URLs), keyed by hotel id, available to the PDF generator. */
  hotelLogos: Record<string, string>;
  /** Editable quote details saved per `${hotelId}:${language}`. */
  hotelDetails: Record<string, HotelDetails>;
  /** Editable room type categories saved per `${hotelId}:${language}`. */
  hotelRoomTypes: Record<string, string[]>;

  /** Transient "+n" notification counters keyed by widget id (not persisted). */
  pulses: Record<string, number>;

  /** Live global search query (not persisted); drives highlighting/filtering across widgets. */
  searchQuery: string;

  /** Transient id of the widget that should briefly "pop" after being opened from a search result. */
  searchPulseId: string | null;

  /** Increments on every search-result open so repeat hits on the same widget re-trigger the shake. */
  searchPulseToken: number;

  /**
   * When true, the quote form/history should surface inline validation
   * messages for missing required fields (recipient, item rates). Set by a
   * failed download attempt; cleared once every required field is filled.
   */
  showQuoteErrors: boolean;

  /** Language used for the notes editor spellcheck / autocorrect dictionary. */
}

interface WorkspaceApi extends WorkspaceState {
  openTool: (tool: ToolId) => void;
  openWidget: (id: string, options?: { fromSearch?: boolean }) => void;
  setNoteText: (t: string) => void;
  saveNoteVersion: () => void;
  restoreNoteVersion: (id: string) => void;
  setWidgetSize: (id: string, size: WidgetSize) => void;
  /** Free (grid-snapped) resize: commits explicit column/row spans. */
  setWidgetDimensions: (id: string, width: number, height: number) => void;
  toggleWidgetSizeLock: (id: string) => void;
  reorderWidgets: (id: string, toIndex: number) => void;
  setHotelLogo: (hotelId: string, dataUrl: string | null) => void;
  setHotelRoomTypes: (hotelId: string, language: "es" | "en", types: string[]) => void;

  addWidgetItem: (type: WidgetType, text: string, opts?: { date?: string; time?: string }) => void;
  addReminder: (title: string, date: string, time?: string) => void;
  addTask: (title: string, date?: string, time?: string) => void;
  toggleTask: (widgetId: string, itemId: string) => void;
  updateTask: (widgetId: string, itemId: string, patch: Partial<TaskItem>) => void;
  setWidgetAccent: (id: string, accent: WidgetAccent) => void;
  setWidgetIcon: (id: string, icon: WidgetIconName) => void;
  renameWidget: (id: string, title: string) => void;
  /** Update the rich-text (HTML) content of a single note item in place. */
  updateNoteContent: (widgetId: string, itemId: string, html: string) => void;
  setTaskStatus: (widgetId: string, itemId: string, status: ItemStatus) => void;
  deleteTask: (widgetId: string, itemId: string) => void;
  updateReminder: (widgetId: string, itemId: string, patch: Partial<ReminderItem>) => void;
  setReminderStatus: (widgetId: string, itemId: string, status: ItemStatus) => void;
  deleteReminder: (widgetId: string, itemId: string) => void;
  addContact: (draft: Omit<ContactItem, "id">) => void;
  updateContact: (widgetId: string, itemId: string, patch: Partial<ContactItem>) => void;
  deleteContact: (widgetId: string, itemId: string) => void;
  deleteNote: (widgetId: string, itemId: string) => void;
  /** Save the draft editor content as a new independent note card. */
  saveNoteToWidget: () => void;
  /**
   * Log a finished call strictly into the isolated Call History — never
   * into the general notes widget/history. Clears the draft editor.
   */
  finishCall: (payload: { html: string; text: string; property: "AR" | "ER" | "RI"; hashtags: string[] }) => void;
  toggleNotePin: (widgetId: string, itemId: string) => void;
  /** Move a saved note back into the draft editor for editing. */
  editNoteInEditor: (widgetId: string, itemId: string) => void;
  convertNoteToSticky: (widgetId: string, itemId: string) => void;
  returnStickyToNotes: (stickyId: string) => void;
  setWidgetTint: (id: string, tint: WidgetAccent) => void;
  clearPulse: (id: string) => void;
  clearSearchPulse: () => void;
  setSearchQuery: (q: string) => void;
  setShowQuoteErrors: (value: boolean) => void;
  updateQuote: (patch: Partial<QuoteDoc>) => void;
  /**
   * Append a change-log entry for a "loggeable" quote field. Call this only
   * when the user COMMITS a field (input blur, or picking an option in a
   * select/date) — never on every keystroke. `from` is the value captured
   * when the field was entered, `to` the final value; if they're equal the
   * call is a no-op. Existing entries are preserved (append-only).
   */
  logQuoteField: (field: QuoteLogField, from: string, to: string) => void;
  archiveQuote: () => void;
  loadQuote: (id: string) => void;
  duplicateQuote: (id: string) => void;
  /** Permanently remove a quote from the saved history. */
  deleteQuote: (id: string) => void;
  /** Reset the quote form to blank defaults (keeping hotel + language). */
  resetQuote: () => void;
}

// Keep a single context identity across hot module reloads, otherwise a
// re-evaluated module creates a new context and consumers see `null`.
const g = globalThis as unknown as { __workspaceCtx?: Context<WorkspaceApi | null> };
const Ctx = g.__workspaceCtx ?? createContext<WorkspaceApi | null>(null);
g.__workspaceCtx = Ctx;
const STORAGE_KEY = "reservation-workspace-v4";

/**
 * Quote fields whose committed changes are recorded in `quote.changeLog`.
 * Long free-text template fields (intro, description, hotelInfo,
 * includedServices, signature, checkIn, checkOut) are intentionally NOT
 * loggeable — they're editable template text, not quote data.
 */
export type QuoteLogField =
  | "company"
  | "recipient"
  | "guest"
  | "salutation"
  | "arrival"
  | "departure"
  | "nights"
  | "itbmsRate";

/** Human-readable labels for each loggeable field (shown in the History panel). */
const QUOTE_LOG_LABELS: Record<QuoteLogField, string> = {
  company: "Empresa",
  recipient: "Destinatario",
  guest: "Huésped",
  salutation: "Tratamiento",
  arrival: "Llegada",
  departure: "Salida",
  nights: "Noches",
  itbmsRate: "ITBMS %",
};

const DETAIL_KEYS = [
  "intro",
  "includedServices",
  "hotelInfo",
  "checkIn",
  "checkOut",
  "signature",
] as const satisfies readonly (keyof QuoteDoc)[];


export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>({
    mode: "tool",
    activeTool: "notes",
    activeWidget: null,
    widgets: DEFAULT_WIDGETS,
    noteText: DEFAULT_NOTE,
    noteHistory: [],
    callHistory: [],
    quote: DEFAULT_QUOTE(),
    quoteHistory: [],
    hotelLogos: {},
    hotelDetails: {},
    hotelRoomTypes: {},

    pulses: {},
    searchQuery: "",
    searchPulseId: null,
    searchPulseToken: 0,
    showQuoteErrors: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<WorkspaceState>;
      // Sessions saved before a new widget type existed won't have it in their
      // stored widget list — append any missing defaults so returning users
      // pick up newly introduced dashboard widgets.
      // Widgets whose type no longer exists (e.g. the removed "stats" widget)
      // are dropped from old saved sessions so they never render as broken cards.
      const savedWidgets = (saved.widgets ?? DEFAULT_WIDGETS).filter(
        (w) =>
          w.content.kind !== ("stats" as string) &&
          w.type !== ("stats" as string) &&
          w.content.kind !== ("information" as string) &&
          w.type !== ("information" as string),
      );

      const missingDefaults = DEFAULT_WIDGETS.filter(
        (d) => !savedWidgets.some((w) => w.type === d.type),
      ).map((d, i) => ({ ...d, position: savedWidgets.length + i }));
      setState((s) => ({
        ...s,
        ...saved,
        widgets: [...savedWidgets, ...missingDefaults],
        // Drop quote documents saved by older versions of the app.
        // The issue date always reflects the current system date on load.
        quote: isValidQuote(saved.quote)
          ? { ...saved.quote, issueDate: todayISO() }
          : s.quote,
        quoteHistory: (saved.quoteHistory ?? []).filter(isValidQuote),
        callHistory: saved.callHistory ?? [],
        pulses: {},
      }));
    } catch {
      /* ignore */
    }
  }, []);


  // Recurring tasks that were checked off "reappear" once the day rolls over:
  // a completed recurring task whose `completedOn` isn't today is reset back
  // to active. Checked on mount and then re-checked periodically so a tab
  // left open across midnight resets without needing a reload.
  useEffect(() => {
    const resetElapsedRecurringTasks = () => {
      const today = todayISO();
      setState((s) => {
        let changed = false;
        const widgets = s.widgets.map((w) => {
          if (w.content.kind !== "tasks") return w;
          const items = w.content.items.map((t) => {
            const isDone = t.status === "done" || t.status === "completed";
            if (!isDone || !t.recurrence || t.recurrence === "none") return t;
            if (t.completedOn === today) return t;
            changed = true;
            const { completedOn, ...rest } = t;
            return { ...rest, status: "active" as TaskItem["status"] };
          });
          return items === w.content.items ? w : { ...w, content: { ...w.content, items } };
        });
        return changed ? { ...s, widgets } : s;
      });
    };
    resetElapsedRecurringTasks();
    const interval = setInterval(resetElapsedRecurringTasks, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, pulses: {} }));
    } catch {
      /* ignore */
    }
  }, [state]);

  // Return to the Notes tool after a prolonged absence. We track the moment the
  // tab becomes hidden (minimize / switch away) via `visibilitychange` — not
  // blur/focus, which fire far too eagerly — and, when it becomes visible
  // again, snap back to Notes only if more than INACTIVITY_THRESHOLD_MS elapsed.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt !== null ? Date.now() - hiddenAt : 0;
      hiddenAt = null;
      if (away >= INACTIVITY_THRESHOLD_MS) {
        setState((s) => ({
          ...s,
          mode: "tool",
          activeTool: "notes",
          activeWidget: null,
          widgets: s.widgets.map((w) => ({ ...w, display: "minimized" })),
        }));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const patchWidgets = useCallback(
    (fn: (w: Widget[]) => Widget[]) => setState((s) => ({ ...s, widgets: fn(s.widgets) })),
    [],
  );

  const api = useMemo<WorkspaceApi>(
    () => ({
      ...state,
      openTool: (tool) =>
        setState((s) => ({
          ...s,
          mode: "tool",
          activeTool: tool,
          activeWidget: null,
          widgets: s.widgets.map((w) => ({ ...w, display: "minimized" })),
        })),
      openWidget: (id, options) =>
        setState((s) => ({
          ...s,
          mode: "widgets",
          activeWidget: id,
          searchPulseId: options?.fromSearch ? id : null,
          searchPulseToken: options?.fromSearch ? s.searchPulseToken + 1 : s.searchPulseToken,
          widgets: s.widgets.map((w) => ({ ...w, display: "expanded" })),
        })),
      clearSearchPulse: () =>
        setState((s) => ({
          ...s,
          searchPulseId: null,
        })),
      setNoteText: (t) => setState((s) => ({ ...s, noteText: t })),
      saveNoteVersion: () =>
        setState((s) => ({
          ...s,
          noteHistory: [
            { id: uid(), text: s.noteText, savedAt: new Date().toLocaleString() },
            ...s.noteHistory,
          ].slice(0, 20),
        })),
      restoreNoteVersion: (id) =>
        setState((s) => {
          const v = s.noteHistory.find((h) => h.id === id);
          return v ? { ...s, noteText: v.text } : s;
        }),
      setWidgetSize: (id, size) => {
        const [w, h] = size.split("x").map(Number) as [WidgetSpan, WidgetSpan];
        patchWidgets((ws) =>
          ws.map((x) => (x.id === id && !isSizeLocked(x) ? { ...x, width: w, height: h } : x)),
        );
      },
      setWidgetDimensions: (id, width, height) => {
        const w = clampSpan(width);
        const h = clampSpan(height);
        patchWidgets((ws) =>
          ws.map((x) => (x.id === id && !isSizeLocked(x) ? { ...x, width: w, height: h } : x)),
        );
      },
      toggleWidgetSizeLock: (id) =>
        patchWidgets((ws) =>
          ws.map((x) => {
            if (x.id !== id) return x;
            const { heightLocked: _legacy, ...rest } = x;
            return { ...rest, sizeLocked: !isSizeLocked(x) };
          }),
        ),
      reorderWidgets: (id, toIndex) =>
        patchWidgets((ws) => {
          const sorted = [...ws].sort((a, b) => a.position - b.position);
          const from = sorted.findIndex((x) => x.id === id);
          if (from < 0 || toIndex < 0 || toIndex >= sorted.length || from === toIndex) return ws;
          const [moved] = sorted.splice(from, 1);
          sorted.splice(toIndex, 0, moved!);
          return sorted.map((x, index) => ({ ...x, position: index }));
        }),
      setHotelLogo: (hotelId, dataUrl) =>
        setState((s) => {
          const next = { ...s.hotelLogos };
          if (dataUrl) next[hotelId] = dataUrl;
          else delete next[hotelId];
          return { ...s, hotelLogos: next };
        }),
      setHotelRoomTypes: (hotelId, language, types) =>
        setState((s) => ({
          ...s,
          hotelRoomTypes: { ...s.hotelRoomTypes, [`${hotelId}:${language}`]: types },
        })),

      addWidgetItem: (type, text, opts) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.type !== type) return w;
            const c = w.content;
            if (c.kind === "tasks")
              return {
                ...w,
                content: {
                  ...c,
                  items: [
                    {
                      id: uid(),
                      title: text,
                      status: "active" as const,
                      ...(opts?.date ? { date: opts.date } : {}),
                      ...(opts?.time ? { time: opts.time } : {}),
                    },
                    ...c.items,
                  ],
                },
              };
            if (c.kind === "reminders")
              return {
                ...w,
                content: {
                  ...c,
                  items: [
                    { id: uid(), title: text, date: "", status: "active" as const },
                    ...c.items,
                  ],
                },
              };
            if (c.kind === "contacts")
              return { ...w, content: { ...c, items: [{ id: uid(), name: text }, ...c.items] } };
            if (c.kind !== "notes") return w;
            return { ...w, content: { ...c, items: [{ id: uid(), text }, ...c.items] } };
          }),
        ),
      addReminder: (title, date, time) =>
        setState((s) => {
          const pulses = { ...s.pulses };
          const widgets = s.widgets.map((w) => {
            if (w.content.kind !== "reminders" || w.type !== "reminders") return w;
            pulses[w.id] = (pulses[w.id] ?? 0) + 1;
            return {
              ...w,
              content: {
                ...w.content,
                items: [
                  { id: uid(), title, date, ...(time ? { time } : {}), status: "active" as const },
                  ...w.content.items,
                ],
              },
            };
          });
          return { ...s, widgets, pulses };
        }),
      addTask: (title, date, time) =>
        setState((s) => {
          const pulses = { ...s.pulses };
          const widgets = s.widgets.map((w) => {
            if (w.content.kind !== "tasks" || w.type !== "tasks") return w;
            pulses[w.id] = (pulses[w.id] ?? 0) + 1;
            return {
              ...w,
              content: {
                ...w.content,
                items: [
                  {
                    id: uid(),
                    title,
                    status: "active" as const,
                    ...(date ? { date } : {}),
                    ...(time ? { time } : {}),
                  },
                  ...w.content.items,
                ],
              },
            };
          });
          return { ...s, widgets, pulses };
        }),
      addContact: (draft) =>
        setState((s) => {
          const pulses = { ...s.pulses };
          const widgets = s.widgets.map((w) => {
            if (w.content.kind !== "contacts") return w;
            pulses[w.id] = (pulses[w.id] ?? 0) + 1;
            return {
              ...w,
              content: { ...w.content, items: [{ id: uid(), ...draft }, ...w.content.items] },
            };
          });
          return { ...s, widgets, pulses };
        }),
      updateContact: (widgetId, itemId, patch) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "contacts") return w;
            return {
              ...w,
              content: {
                ...w.content,
                items: w.content.items.map((c) => (c.id === itemId ? { ...c, ...patch } : c)),
              },
            };
          }),
        ),
      deleteContact: (widgetId, itemId) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "contacts") return w;
            return {
              ...w,
              content: { ...w.content, items: w.content.items.filter((c) => c.id !== itemId) },
            };
          }),
        ),
      deleteNote: (widgetId, itemId) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "notes") return w;
            return {
              ...w,
              content: { ...w.content, items: w.content.items.filter((n) => n.id !== itemId) },
            };
          }),
        ),
      saveNoteToWidget: () =>
        setState((s) => {
          const html = s.noteText;
          if (!html.replace(/<[^>]*>/g, "").trim() && !/<img/i.test(html)) return s;
          const target = s.widgets.find(
            (w) => w.type === "notes" && w.content.kind === "notes",
          );
          return {
            ...s,
            noteText: "",
            noteHistory: [
              { id: uid(), text: html, savedAt: new Date().toLocaleString() },
              ...s.noteHistory,
            ].slice(0, 20),
            pulses: target ? { ...s.pulses, [target.id]: (s.pulses[target.id] ?? 0) + 1 } : s.pulses,
            widgets: s.widgets.map((w) =>
              w.id === target?.id && w.content.kind === "notes"
                ? {
                    ...w,
                    content: {
                      ...w.content,
                      items: [
                        { id: uid(), text: html, savedAtISO: new Date().toISOString() },
                        ...w.content.items,
                      ],
                    },
                  }
                : w,
            ),
          };
        }),
      finishCall: ({ html, text, property, hashtags }) =>
        setState((s) => {
          if (!text.trim() && !/<img/i.test(html)) return s;
          const now = new Date();
          return {
            ...s,
            noteText: "",
            // Deliberately does NOT touch `widgets`/`noteHistory` — call
            // logs must never surface in the general Notes widget/history.
            callHistory: [
              {
                id: uid(),
                html,
                text,
                property,
                hashtags,
                savedAtISO: now.toISOString(),
                savedAt: now.toLocaleString(),
              },
              ...s.callHistory,
            ].slice(0, 500),
          };
        }),
      toggleNotePin: (widgetId, itemId) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "notes") return w;
            return {
              ...w,
              content: {
                ...w.content,
                items: w.content.items.map((n) =>
                  n.id === itemId ? { ...n, pinned: !n.pinned } : n,
                ),
              },
            };
          }),
        ),
      editNoteInEditor: (widgetId, itemId) =>
        setState((s) => {
          const w = s.widgets.find((x) => x.id === widgetId);
          if (!w || w.content.kind !== "notes") return s;
          const item = w.content.items.find((n) => n.id === itemId);
          if (!item) return s;
          return {
            ...s,
            mode: "tool",
            activeTool: "notes",
            activeWidget: null,
            noteText: item.text,
            widgets: s.widgets.map((x) =>
              x.id === widgetId && x.content.kind === "notes"
                ? {
                    ...x,
                    display: "minimized",
                    content: { ...x.content, items: x.content.items.filter((n) => n.id !== itemId) },
                  }
                : { ...x, display: "minimized" },
            ),
          };
        }),
      convertNoteToSticky: (widgetId, itemId) =>

        patchWidgets((ws) => {
          const source = ws.find((w) => w.id === widgetId);
          if (!source || source.content.kind !== "notes") return ws;
          const item = source.content.items.find((n) => n.id === itemId);
          if (!item) return ws;
          const maxPos = ws.reduce((m, w) => Math.max(m, w.position), -1);
          const sticky: Widget = {
            id: `sticky-${uid()}`,
            type: "sticky",
            title:
              item.text
                .replace(/<[^>]*>/g, " ")
                .replace(/&nbsp;/g, " ")
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 3)
                .join(" ") || "Sticky",
            position: maxPos + 1,
            width: 1,
            height: 1,
            display: source.display,
            accent: "yellow",
            tint: "yellow",
            icon: "note",
            content: { kind: "notes", items: [{ ...item }] },
          };
          return [
            ...ws.map((w) =>
              w.id === widgetId && w.content.kind === "notes"
                ? {
                    ...w,
                    content: {
                      ...w.content,
                      items: w.content.items.filter((n) => n.id !== itemId),
                    },
                  }
                : w,
            ),
            sticky,
          ];
        }),
      returnStickyToNotes: (stickyId) =>
        patchWidgets((ws) => {
          const sticky = ws.find((w) => w.id === stickyId);
          if (!sticky || sticky.type !== "sticky") return ws;
          const kind = sticky.content.kind;
          if (kind !== "notes") return ws;
          const moved = sticky.content.items as Array<{ id: string }>;
          return ws
            .filter((w) => w.id !== stickyId)
            .map((w) => {
              if (w.type === "sticky" || w.content.kind !== kind) return w;
              return {
                ...w,
                content: { ...w.content, items: [...moved, ...w.content.items] },
              } as Widget;
            })
            .sort((a, b) => a.position - b.position)
            .map((w, index) => ({ ...w, position: index }));
        }),
      setWidgetTint: (id, tint) =>
        patchWidgets((ws) => ws.map((x) => (x.id === id ? { ...x, tint } : x))),
      clearPulse: (id) =>
        setState((s) => {
          if (!(id in s.pulses)) return s;
          const pulses = { ...s.pulses };
          delete pulses[id];
          return { ...s, pulses };
        }),
      setSearchQuery: (q) => setState((s) => ({ ...s, searchQuery: q })),
      toggleTask: (widgetId, itemId) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "tasks") return w;
            return {
              ...w,
              content: {
                ...w.content,
                items: w.content.items.map((t) => {
                  if (t.id !== itemId) return t;
                  const wasDone = t.status === "done" || t.status === "completed";
                  const status = (wasDone ? "active" : "completed") as TaskItem["status"];
                  if (wasDone) {
                    const { completedOn, completedAt, ...rest } = t;
                    return { ...rest, status };
                  }
                  return { ...t, status, completedOn: todayISO(), completedAt: Date.now() };
                }),
              },
            };
          }),
        ),
      updateTask: (widgetId, itemId, patch) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "tasks") return w;
            return {
              ...w,
              content: {
                ...w.content,
                items: w.content.items.map((t) => (t.id === itemId ? { ...t, ...patch } : t)),
              },
            };
          }),
        ),
      setWidgetAccent: (id, accent) =>
        patchWidgets((ws) => ws.map((x) => (x.id === id ? { ...x, accent } : x))),
      setWidgetIcon: (id, icon) =>
        patchWidgets((ws) => ws.map((x) => (x.id === id ? { ...x, icon } : x))),
      renameWidget: (id, title) =>
        patchWidgets((ws) => ws.map((x) => (x.id === id ? { ...x, title } : x))),
      updateNoteContent: (widgetId, itemId, html) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "notes") return w;
            return {
              ...w,
              content: {
                ...w.content,
                items: w.content.items.map((n) => (n.id === itemId ? { ...n, text: html } : n)),
              },
            };
          }),
        ),
      setTaskStatus: (widgetId, itemId, status) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "tasks") return w;
            return {
              ...w,
              content: {
                ...w.content,
                items: w.content.items.map((t) =>
                  t.id === itemId
                    ? {
                        ...t,
                        status,
                        completedAt:
                          status === "completed" || status === "archived" ? Date.now() : null,
                      }
                    : t,
                ),
              },
            };
          }),
        ),
      deleteTask: (widgetId, itemId) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "tasks") return w;
            return {
              ...w,
              content: {
                ...w.content,
                items: w.content.items.filter((t) => t.id !== itemId),
              },
            };
          }),
        ),
      updateReminder: (widgetId, itemId, patch) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "reminders") return w;
            return {
              ...w,
              content: {
                ...w.content,
                items: w.content.items.map((r) => (r.id === itemId ? { ...r, ...patch } : r)),
              },
            };
          }),
        ),
      setReminderStatus: (widgetId, itemId, status) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "reminders") return w;
            return {
              ...w,
              content: {
                ...w.content,
                items: w.content.items.map((r) =>
                  r.id === itemId
                    ? {
                        ...r,
                        status,
                        completedAt:
                          status === "completed" || status === "archived" ? Date.now() : null,
                      }
                    : r,
                ),
              },
            };
          }),
        ),
      deleteReminder: (widgetId, itemId) =>
        patchWidgets((ws) =>
          ws.map((w) => {
            if (w.id !== widgetId || w.content.kind !== "reminders") return w;
            return {
              ...w,
              content: {
                ...w.content,
                items: w.content.items.filter((r) => r.id !== itemId),
              },
            };
          }),
        ),
      updateQuote: (patch) =>
        setState((s) => {
          const prev = s.quote;
          const quote = { ...prev, ...patch, updatedAt: new Date().toISOString() };
          // Auto-save the editable detail texts per hotel + language.
          const touchesDetails = DETAIL_KEYS.some((k) => k in patch);
          if (!touchesDetails || !quote.hotelId) return { ...s, quote };
          const key = `${quote.hotelId}:${quote.language}`;
          const details: HotelDetails = {
            intro: quote.intro,
            includedServices: [...quote.includedServices],
            hotelInfo: quote.hotelInfo,
            checkIn: quote.checkIn,
            checkOut: quote.checkOut,
            signature: quote.signature,
          };
          return { ...s, quote, hotelDetails: { ...s.hotelDetails, [key]: details } };
        }),
      // Change logging happens at field-commit level (blur / option select),
      // not per keystroke: callers capture the value on field entry and pass
      // it as `from`; unchanged values are ignored. Append-only.
      logQuoteField: (field, from, to) =>
        setState((s) => {
          if (from === to) return s;
          if (s.quote.status !== "editing" && s.quote.status !== "duplicated") return s;
          const entry = { label: QUOTE_LOG_LABELS[field], from, to, at: new Date().toISOString() };
          return {
            ...s,
            quote: { ...s.quote, changeLog: [...(s.quote.changeLog ?? []), entry] },
          };
        }),
      archiveQuote: () =>
        setState((s) => ({
          ...s,
          quoteHistory: [{ ...s.quote }, ...s.quoteHistory.filter((q) => q.id !== s.quote.id)].slice(0, 20),
        })),
      loadQuote: (id) =>
        setState((s) => {
          const q = s.quoteHistory.find((x) => x.id === id);
          return q ? { ...s, quote: { ...q, status: "editing" }, showQuoteErrors: false } : s;
        }),
      duplicateQuote: (id) =>
        setState((s) => {
          const q = s.quoteHistory.find((x) => x.id === id) ?? s.quote;
          return {
            ...s,
            quote: {
              ...q,
              id: `q-${uid()}`,
              updatedAt: new Date().toISOString(),
              duplicatedFrom: quoteNumber(q),
              changeLog: [],
              status: "duplicated",
            },
            showQuoteErrors: false,
          };
        }),
      deleteQuote: (id) =>
        setState((s) => ({
          ...s,
          quoteHistory: s.quoteHistory.filter((q) => q.id !== id),
        })),
      resetQuote: () =>
        setState((s) => {
          const hotel = s.quote.hotelId ? getHotel(s.quote.hotelId) : getHotel("residence-inn");
          const lang = s.quote.language;
          const fresh = DEFAULT_QUOTE();
          const savedRooms = s.hotelRoomTypes[`${hotel.id}:${lang}`];
          const firstRoom = savedRooms?.[0] ?? hotel.roomTypes[0] ?? "";
          const d = s.hotelDetails[`${hotel.id}:${lang}`] ?? {
            intro: hotel[lang].intro,
            includedServices: [...hotel[lang].includedServices],
            hotelInfo: hotel[lang].hotelInfo,
            checkIn: hotel.checkIn,
            checkOut: hotel.checkOut,
            signature: hotel[lang].signature,
          };
          return {
            ...s,
            quote: {
              ...fresh,
              hotelId: hotel.id,
              language: lang,
              intro: d.intro,
              includedServices: [...d.includedServices],
              hotelInfo: d.hotelInfo,
              checkIn: d.checkIn,
              checkOut: d.checkOut,
              signature: d.signature,
              items: [{ ...fresh.items[0]!, roomType: firstRoom }],
              status: "new",
            },
            showQuoteErrors: false,
          };
        }),
      setShowQuoteErrors: (value) => setState((s) => ({ ...s, showQuoteErrors: value })),
    }),
    [state, patchWidgets],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export { sizeOf, uid };
