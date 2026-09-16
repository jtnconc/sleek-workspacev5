export type EntityType =
  | "person"
  | "date"
  | "reservation"
  | "confirmation"
  | "email"
  | "phone"
  | "hotel"
  | "place";

export interface Entity {
  type: EntityType;
  value: string;
  start: number;
  end: number;
}

export interface Token {
  text: string;
  entity?: EntityType;
}

const MONTHS =
  "(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)";

const HOTEL_WORDS = "(?:hotel|resort|hostal|lodge|inn|apart(?:amento)?|suites)";
const PLACES = [
  "Boquete",
  "Bocas del Toro",
  "Ciudad de Panamá",
  "Panama City",
  "Playa Blanca",
  "David",
  "Coclé",
  "Chiriquí",
  "San Blas",
  "Pedasí",
];

/** Month names plus common Spanish/English abbreviations. */
const MONTHS_ANY =
  "(?:ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|setiembre|oct|octubre|nov|noviembre|dic|diciembre|jan|january|february|march|april|june|july|august|september|october|november|december)";

const PATTERNS: { type: EntityType; re: RegExp }[] = [
  { type: "email", re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/gi },
  {
    // Panamanian numbers: 8-digit mobile with hyphen, 7-digit landline, +507 prefixed.
    type: "phone",
    re: /(?<![\d-])(?:\+?507[\s-]?)?(?:\d{4}-\d{4}|\d{3}-\d{4}|[2-5]\d{6,7})(?![\d-])/g,
  },
  {
    // Confirmation numbers: exactly 8 digits starting with 6, 7, 8 or 9.
    type: "confirmation",
    re: /(?<![\d-])[6-9]\d{7}(?![\d-])/g,
  },
  { type: "confirmation", re: /\b(?:conf(?:irmaci[oó]n|irmation)?\.?\s*(?:code|c[oó]digo)?\s*[:#]?\s*)([A-Z0-9]{5,12})\b/gi },
  {
    // Abbreviated date ranges: "22-25", "22-25/09", "22-25 sep", "22 al 25 sep"
    type: "date",
    re: new RegExp(
      `\\b\\d{1,2}\\s*(?:-|–|a\\s+|al\\s+)\\s*\\d{1,2}(?:\\s*\\/\\s*\\d{1,2}(?:\\s*\\/\\s*\\d{2,4})?|\\s+(?:de\\s+)?${MONTHS_ANY}\\.?(?:\\s+(?:de\\s+)?\\d{4})?)?\\b`,
      "gi",
    ),
  },
  {
    type: "reservation",
    re: /\b(?:reserva(?:ci[oó]n)?|reservation|res\.?)\s*(?:n[oº°]?\.?|#|:)?\s*(\d{4,8})\b/gi,
  },
  {
    type: "date",
    re: new RegExp(
      `\\b(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}|\\d{1,2}\\s+(?:de\\s+)?${MONTHS}(?:\\s+(?:de\\s+)?\\d{4})?|${MONTHS}\\s+\\d{1,2}(?:,?\\s+\\d{4})?|ma[ñn]ana|hoy|tomorrow|today)\\b`,
      "gi",
    ),
  },
  {
    // Day/month without year: "26/07", "26-07"
    type: "date",
    re: /(?<![\d/-])\d{1,2}[/]\d{1,2}(?![\d/])/g,
  },
  {
    // Abbreviated month names: "26 jul", "jul 26", "26 de jul.", "24sep"
    type: "date",
    re: new RegExp(
      `\\b(?:\\d{1,2}\\s*(?:de\\s+)?${MONTHS_ANY}\\.?(?:\\s+(?:de\\s+)?\\d{4})?|${MONTHS_ANY}\\.?\\s+\\d{1,2}(?:,?\\s+\\d{4})?)\\b`,
      "gi",
    ),
  },

  { type: "hotel", re: new RegExp(`\\b${HOTEL_WORDS}\\s+[A-ZÁÉÍÓÚÑ][\\wáéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][\\wáéíóúñ]+)?`, "g") },
  { type: "place", re: new RegExp(`\\b(?:${PLACES.join("|")})\\b`, "gi") },
  { type: "person", re: /\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\b/g },
];

/** Local, mock entity recognition. Swap for an AI service later. */
export function parseEntities(text: string): Entity[] {
  const found: Entity[] = [];
  const overlaps = (s: number, e: number) => found.some((f) => s < f.end && e > f.start);

  for (const { type, re } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const group = m[1];
      const raw = group ?? m[0];
      const start = group ? m.index + m[0].indexOf(group) : m.index;
      const end = start + raw.length;
      if (!overlaps(start, end)) found.push({ type, value: raw, start, end });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

export function tokenize(text: string): Token[] {
  const entities = parseEntities(text);
  const tokens: Token[] = [];
  let cursor = 0;
  for (const e of entities) {
    if (e.start > cursor) tokens.push({ text: text.slice(cursor, e.start) });
    tokens.push({ text: text.slice(e.start, e.end), entity: e.type });
    cursor = e.end;
  }
  if (cursor < text.length) tokens.push({ text: text.slice(cursor) });
  return tokens;
}

export const ENTITY_STYLES: Record<EntityType, { label: string; className: string }> = {
  person: { label: "Person", className: "bg-entity-person-bg text-entity-person" },
  date: { label: "Date", className: "bg-entity-date-bg text-entity-date" },
  reservation: { label: "Reservation", className: "bg-entity-reservation-bg text-entity-reservation font-mono" },
  confirmation: { label: "Confirmation", className: "bg-entity-confirmation-bg text-entity-confirmation font-mono" },
  email: { label: "Email", className: "bg-entity-email-bg text-entity-email" },
  phone: { label: "Phone", className: "bg-entity-phone-bg text-entity-phone font-mono" },
  hotel: { label: "Property", className: "bg-entity-hotel-bg text-entity-hotel" },
  place: { label: "Destination", className: "bg-entity-place-bg text-entity-place" },
};

const MONTH_INDEX: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Best-effort conversion of a recognized date string to an ISO date (YYYY-MM-DD). */
export function toISODate(text: string, today = new Date()): string {
  const t = text.trim().toLowerCase();
  const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

  if (/^(hoy|today)$/.test(t)) return iso(today.getFullYear(), today.getMonth() + 1, today.getDate());
  if (/^(ma[ñn]ana|tomorrow)$/.test(t)) {
    const d = new Date(today.getTime() + 86400000);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  const full = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) return iso(+full[1]!, +full[2]!, +full[3]!);

  // 22-25/09[/2026] or 22/09/2026 — take the first day.
  const numeric = t.match(/^(\d{1,2})(?:\s*(?:-|–|al?\s+)\s*\d{1,2})?\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?$/);
  if (numeric) {
    const y = numeric[3] ? (numeric[3].length === 2 ? 2000 + +numeric[3] : +numeric[3]) : today.getFullYear();
    return iso(y, +numeric[2]!, +numeric[1]!);
  }

  // 22-25 sep / 22 al 25 septiembre / 12 de septiembre [de 2026] / 24sep
  const named = t.match(
    /^(\d{1,2})(?:\s*(?:-|–|al?\s+)\s*\d{1,2})?\s*(?:de\s+)?([a-záéíóúñ]+)\.?(?:\s+(?:de\s+)?(\d{4}))?$/,
  );
  if (named) {
    const month = MONTH_INDEX[named[2]!.slice(0, 3)];
    if (month) return iso(named[3] ? +named[3] : today.getFullYear(), month, +named[1]!);
  }

  // sep 22 / september 22, 2026
  const namedFirst = t.match(/^([a-záéíóúñ]+)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (namedFirst) {
    const month = MONTH_INDEX[namedFirst[1]!.slice(0, 3)];
    if (month) return iso(namedFirst[3] ? +namedFirst[3] : today.getFullYear(), month, +namedFirst[2]!);
  }

  // Bare day range like "22-25": assume the current month.
  const bare = t.match(/^(\d{1,2})\s*(?:-|–|al?\s+)\s*\d{1,2}$/);
  if (bare) return iso(today.getFullYear(), today.getMonth() + 1, +bare[1]!);

  return "";
}

/** Colon-less clock times written as "1030am", "700pm", "7 am". */
const TIME_RE = /(?<!\d)(\d{1,4})\s*(am|pm)\b/i;

/** Convert "1030am" / "700am" / "7pm" into 24h "HH:MM". */
function toTime(digits: string, meridiem: string): string {
  let hours: number;
  let minutes = 0;
  if (digits.length >= 3) {
    hours = +digits.slice(0, digits.length - 2);
    minutes = +digits.slice(-2);
  } else {
    hours = +digits;
  }
  if (hours > 12 || minutes > 59) return "";
  const pm = meridiem.toLowerCase() === "pm";
  if (hours === 12) hours = pm ? 12 : 0;
  else if (pm) hours += 12;
  return `${pad(hours)}:${pad(minutes)}`;
}

export interface NoteEntry {
  title: string;
  date: string;
  time?: string;
}

/** Shared parse for the "*" (reminder) and "/" (task) note shortcuts. */
function extractEntry(text: string, trigger: RegExp): NoteEntry {
  // Strip the trailing trigger first so a date's own "/" survives (27/9/).
  let clean = text.replace(trigger, "").trim();

  let time = "";
  const timeMatch = clean.match(TIME_RE);
  if (timeMatch) {
    time = toTime(timeMatch[1]!, timeMatch[2]!);
    if (time) clean = (clean.slice(0, timeMatch.index!) + clean.slice(timeMatch.index! + timeMatch[0].length)).trim();
  }

  const dateEntity = parseEntities(clean).find((e) => e.type === "date");
  const date = dateEntity ? toISODate(dateEntity.value) : "";
  const title =
    (dateEntity
      ? (clean.slice(0, dateEntity.start) + clean.slice(dateEntity.end)).replace(/\s{2,}/g, " ")
      : clean
    )
      .replace(/^[\s,;:.\-–/]+|[\s,;:.\-–/]+$/g, "")
      .trim() || clean;
  return { title, date, ...(time ? { time } : {}) };
}

/** Turn a note line ending in "*" into reminder data (title + ISO date + time). */
export function extractReminder(text: string): NoteEntry {
  return extractEntry(text, /\*+\s*$/);
}

/** Turn a note line ending in "/" into task data (title + ISO date + time). */
export function extractTask(text: string): NoteEntry {
  return extractEntry(text, /\/+\s*$/);
}


export interface ContactDraft {
  name: string;
  phone?: string;
}

/** Turn a note line ending in "#" into contact data (name + phone only). */
export function extractContact(text: string): ContactDraft {
  const clean = text.replace(/#+\s*$/, "").trim();
  const entities = parseEntities(clean);
  // Within contacts, 8-digit "confirmation"-looking numbers are phone numbers.
  const phoneEntity = entities.find(
    (e) => e.type === "phone" || (e.type === "confirmation" && /^[\d+\s-]+$/.test(e.value)),
  );
  const phone = phoneEntity?.value;
  const person = entities.find((e) => e.type === "person")?.value;

  // Remove the recognized number from the raw text to guess the name.
  const rest = phone ? clean.replace(phone, " ") : clean;
  const parts = rest
    .split(/[·,;|\n]+/)
    .map((p) => p.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  const name = (person ?? parts[0] ?? clean).trim();

  return {
    name: name || clean,
    ...(phone ? { phone } : {}),
  };
}
