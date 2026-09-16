export type ToolId = "notes" | "quote" | "rates";

export type WidgetType =
  | "reminders"
  | "contacts"
  | "notes"
  | "information"
  | "tasks"
  /** Independent sticky note extracted from the main Notes widget. */
  | "sticky";

/** Quick-pick size presets offered in the widget header. */
export type WidgetSize = "1x1" | "1x2" | "2x1";

/** Number of grid units a card may span on either axis (grid is 4 columns). */
export type WidgetSpan = 1 | 2 | 3 | 4;

export type WidgetDisplayState = "minimized" | "expanded";

/** Predefined, subtle widget accent palette. */
export type WidgetAccent =
  | "neutral"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple";

export type ItemStatus = "active" | "completed" | "archived";

/** Curated icon set a widget can be customized with. */
export type WidgetIconName =
  | "bell"
  | "check"
  | "note"
  | "info"
  | "users"
  | "calendar"
  | "phone"
  | "plane"
  | "key"
  | "pin"
  | "coffee"
  | "briefcase"
  | "bookmark"
  | "chart";

export interface ReminderItem {
  id: string;
  title: string;
  /** ISO date (YYYY-MM-DD) — legacy values may include a trailing time. */
  date: string;
  /** 24h time (HH:MM) */
  time?: string;
  /** Minutes before the scheduled date/time to surface the alert (0 = at
   * time of event). Defaults to 15 when unset. */
  notifyMinutesBefore?: number;
  status?: ItemStatus;
  done?: boolean;
  /** Marked important via the "Flag" quick action; drives the Flagged filter. */
  flagged?: boolean;
  /** Timestamp (ms) when the reminder was marked completed; cleared on uncomplete. */
  completedAt?: number | null;
}

/** Broad relationship bucket a contact belongs to; drives the Contacts filter chips. */
export type ContactCategory = "hotel" | "agent" | "client";

export interface ContactItem {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  /** Defaults to "client" when unset. */
  category?: ContactCategory;
  favorite?: boolean;
}

/** How a task repeats. "none" is a plain, one-off task. */
export type TaskRecurrence = "none" | "daily" | "weekdays" | "custom" | "specific-time";

export interface TaskItem {
  id: string;
  title: string;
  /** "open"/"done" kept for backwards compatibility with stored data */
  status: "open" | "done" | "active" | "completed" | "archived";
  /** Recurrence pattern; absent/"none" means a plain one-off task. */
  recurrence?: TaskRecurrence;
  /** Used when recurrence === "custom": 0 = Sunday … 6 = Saturday. */
  customDays?: number[];
  /** ISO date (YYYY-MM-DD) — optional starting/reference date. */
  date?: string;
  /** 24h time (HH:MM) — optional scheduled time. */
  time?: string;
  /** Minutes before the scheduled date/time to surface the alert (0 = at
   * time of event). Defaults to 15 when unset. */
  notifyMinutesBefore?: number;
  /** ISO date (YYYY-MM-DD) the task was last marked completed. Recurring
   * tasks whose `completedOn` isn't today automatically reset to active. */
  completedOn?: string;
  /** Marked important via the "Mark urgent" quick action; drives the Urgent filter. */
  priority?: "normal" | "urgent";
  /** Timestamp (ms) when the task was marked completed; cleared on uncomplete. */
  completedAt?: number | null;
}

export interface InformationItem {
  id: string;
  label: string;
  value: string;
  /** pinned rows render at the top of the INFORMATION widget */
  pinned?: boolean;
}

export interface NoteRefItem {
  id: string;
  text: string;
  /** pinned notes render at the top of the NOTES widget */
  pinned?: boolean;
  /** ISO 8601 timestamp of when the note was saved — powers history search. */
  savedAtISO?: string;
}

export type WidgetContent =
  | { kind: "reminders"; items: ReminderItem[] }
  | { kind: "contacts"; items: ContactItem[] }
  | { kind: "tasks"; items: TaskItem[] }
  | { kind: "information"; items: InformationItem[] }
  | { kind: "notes"; items: NoteRefItem[] };

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  /** order position inside the controlled grid (dense flow) */
  position: number;
  width: WidgetSpan;
  height: WidgetSpan;
  display: WidgetDisplayState;
  /** predefined subtle accent color for this widget */
  accent?: WidgetAccent;
  /** customized header icon (falls back to the type default) */
  icon?: WidgetIconName;
  /** ultra-light pastel background tint (sticky notes only) */
  tint?: WidgetAccent;
  /** when true, both the card's width and height are pinned: presets and the
   * drag-resize handle are disabled and overflow scrolls internally */
  sizeLocked?: boolean;
  /** legacy field kept for persisted state written before the size lock existed */
  heightLocked?: boolean;
  content: WidgetContent;
}

export interface NoteVersion {
  id: string;
  text: string;
  savedAt: string;
}

/**
 * A single completed call, logged when "End call" is pressed in the Notes
 * tool. Kept strictly separate from the general Notes widget/history —
 * powers the Call History side panel in the Notes tool.
 */
export interface CallLogEntry {
  id: string;
  /** Rich HTML content of the note at the time the call was finished. */
  html: string;
  /** Plain-text content, used for search. */
  text: string;
  /** Property code active when the call was finished. */
  property: "AR" | "ER" | "RI";
  /** Action hashtags found in the note (e.g. "#Reserva"). */
  hashtags: string[];
  /** ISO 8601 timestamp — used for date-range / day-of-week filtering. */
  savedAtISO: string;
  /** Human-readable timestamp for display. */
  savedAt: string;
}

export type QuoteLanguage = "es" | "en";

export type Accommodation = "Single" | "Double" | "Triple" | "Quadruple";

/** Greeting treatment used in the PDF salutation. */
export type Salutation = "Estimado" | "Estimada";

/** Editable per-hotel detail texts persisted per hotel + language. */
export interface HotelDetails {
  intro: string;
  includedServices: string[];
  hotelInfo: string;
  checkIn: string;
  checkOut: string;
  signature: string;
}

export interface QuoteLineItem {
  id: string;
  /** "room" (default) is a standard accommodation row; "other" is a free-text
   * service row (e.g. catering) with an open description instead of a room type. */
  kind?: "room" | "other";
  /** Only meaningful for kind === "other". "perNight" (default) multiplies by
   * nights like room rows; "flat" charges the rate once regardless of nights. */
  billingMode?: "perNight" | "flat";
  quantity: number;
  /** Room type for "room" rows; free-text description for "other" rows. */
  roomType: string;
  accommodation: Accommodation;
  /** Guest name for this specific room row */
  guestName?: string;
  /** Per-row check-in (ISO). Falls back to the quote-level arrival. */
  arrival?: string;
  /** Per-row check-out (ISO). Falls back to the quote-level departure. */
  departure?: string;
  ratePerNight: number;
  /** ITBMS applied to this item's subtotal */
  itbms: boolean;
}


export interface QuoteDoc {
  id: string;
  hotelId: string;
  language: QuoteLanguage;
  /** ISO date, defaults to today */
  issueDate: string;
  arrival: string;
  departure: string;
  nights: number;
  /** true when the user typed nights manually instead of deriving them */
  nightsOverride: boolean;
  /** "Estimado" / "Estimada" treatment for the recipient */
  salutation?: Salutation;
  recipient: string;
  company: string;
  guest: string;
  intro: string;
  description: string;
  descriptionEdited: boolean;
  items: QuoteLineItem[];
  /** ITBMS percentage (0.1 = 10%) */
  itbmsRate: number;
  includedServices: string[];
  hotelInfo: string;
  checkIn: string;
  checkOut: string;
  signature: string;
  updatedAt: string;
  /**
   * Lightweight log of actionable field changes, most recent last. Entries
   * are recorded at field-commit level (input blur, or select/date option
   * selection) — never per keystroke — and only for the loggeable quote-data
   * fields (company, recipient, guest, salutation, arrival, departure,
   * nights, itbmsRate). Long template texts (intro, description, hotelInfo,
   * includedServices, signature, checkIn, checkOut) are never logged.
   */
  changeLog?: { label: string; from: string; to: string; at: string }[];
  /** Quote number of the original quote, if this quote is a duplicate. */
  duplicatedFrom?: string;
  /** Lifecycle status shown as a small pill next to the quotation number. */
  status?: "new" | "editing" | "duplicated";
}

/** Per-language editable text content of a hotel. */
export interface HotelLangContent {
  intro: string;
  descriptionTemplate: string;
  includedServices: string[];
  hotelInfo: string;
  signature: string;
}

export interface HotelTemplate {
  id: string;
  name: string;
  /** Optional shorter display name for UI dropdowns/pills. */
  shortName?: string;
  address: string;
  /** Optional bundled or uploaded logo image (URL or data URL). */
  logoUrl?: string;
  accent: string;
  /** complementary/secondary brand color for details and borders */
  secondary?: string;
  /** pale brand-derived background used for cards in the PDF */
  tint?: string;
  roomTypes: string[];
  accommodations: Accommodation[];
  checkIn: string;
  checkOut: string;
  taxRate: number;
  taxLabel: string;
  es: HotelLangContent;
  en: HotelLangContent;
}


export type WorkspaceMode = "tool" | "widgets";
