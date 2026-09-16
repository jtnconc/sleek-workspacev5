import type { HotelTemplate, QuoteDoc, QuoteLanguage, QuoteLineItem } from "@/workspace/types";

const MONTHS = {
  es: [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
} as const;

const parts = (iso: string) => {
  const [y, m, d] = (iso || "").split("-").map(Number);
  return { y: y ?? 2026, m: (m ?? 1) - 1, d: d ?? 1 };
};

/** Local calendar date (YYYY-MM-DD) for a given Date, using the machine's
 * timezone — never UTC. Use this to derive day keys from a stored timestamp
 * so they line up with `todayISO()`. */
export function localISODate(date: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function todayISO() {
  return localISODate(new Date());
}

export function formatDate(iso: string, lang: QuoteLanguage = "es") {
  const { y, m, d } = parts(iso);
  const month = MONTHS[lang][m] ?? "";
  return lang === "es" ? `${d} de ${month} de ${y}` : `${month} ${d}, ${y}`;
}

/** Kept for existing callers that always render Spanish dates. */
export const formatDateES = (iso: string) => formatDate(iso, "es");

const MONTHS_SHORT = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

export function formatDateShort(iso: string) {
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m]} ${y}`;
}

/** Full timestamp for change-log entries, e.g. "10/09/26, 2:37 PM".
 * Unlike `formatDateShort` (which expects a date-only "YYYY-MM-DD" string),
 * this expects a full ISO datetime (e.g. from `new Date().toISOString()`). */
export function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${dd}/${mm}/${yy}, ${hours}:${minutes} ${ampm}`;
}

export function nightsBetween(arrival: string, departure: string) {
  const a = new Date(`${arrival}T00:00:00Z`).getTime();
  const b = new Date(`${departure}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}


const PAX: Record<string, number> = { Single: 1, Double: 2, Triple: 3, Quadruple: 4 };

/** Compact date range: "del 26 al 27 de julio de 2026" / "from July 26 to 27, 2026". */
export function formatDateRange(arrival: string, departure: string, lang: QuoteLanguage = "es") {
  const a = parts(arrival);
  const b = parts(departure);
  const months = MONTHS[lang];
  if (lang === "es") {
    if (a.y === b.y && a.m === b.m) return `del ${a.d} al ${b.d} de ${months[a.m]} de ${a.y}`;
    if (a.y === b.y)
      return `del ${a.d} de ${months[a.m]} al ${b.d} de ${months[b.m]} de ${a.y}`;
    return `del ${a.d} de ${months[a.m]} de ${a.y} al ${b.d} de ${months[b.m]} de ${b.y}`;
  }
  if (a.y === b.y && a.m === b.m) return `from ${months[a.m]} ${a.d} to ${b.d}, ${a.y}`;
  if (a.y === b.y) return `from ${months[a.m]} ${a.d} to ${months[b.m]} ${b.d}, ${a.y}`;
  return `from ${months[a.m]} ${a.d}, ${a.y} to ${months[b.m]} ${b.d}, ${b.y}`;
}

/** Description auto-built from the quotation data; user may override it. */
export function buildDescription(quote: QuoteDoc, _hotel?: HotelTemplate) {
  const lang: QuoteLanguage = quote.language === "en" ? "en" : "es";
  const item = quote.items[0];
  const pax = item ? (PAX[item.accommodation] ?? 1) : 1;
  const range = formatDateRange(quote.arrival, quote.departure, lang);
  return lang === "es"
    ? `Habitación con desayuno para ${pax} ${pax === 1 ? "persona" : "personas"} ${range}.`
    : `Room with breakfast for ${pax} ${pax === 1 ? "person" : "people"} ${range}.`;
}

/** Nights for a specific row: its own date range when set, else the quote's. */
export function itemNights(item: QuoteLineItem, quote: QuoteDoc) {
  if (item.arrival && item.departure) {
    return Math.max(1, nightsBetween(item.arrival, item.departure));
  }
  return Math.max(0, quote.nights);
}

const itemRange = (item: QuoteLineItem, quote: QuoteDoc) => ({
  arrival: item.arrival || quote.arrival,
  departure: item.departure || quote.departure,
});

/** Per-row description based on the specific item accommodation and its own dates. */
export function buildItemDescription(item: QuoteLineItem, quote: QuoteDoc) {
  const lang: QuoteLanguage = quote.language === "en" ? "en" : "es";
  if (item.kind === "other") {
    return item.roomType.trim() || (lang === "es" ? "Servicio adicional" : "Additional service");
  }
  const pax = PAX[item.accommodation] ?? 1;
  const { arrival, departure } = itemRange(item, quote);
  const range = formatDateRange(arrival, departure, lang);
  return lang === "es"
    ? `Habitación con desayuno para ${pax} ${pax === 1 ? "persona" : "personas"} ${range}.`
    : `Room with breakfast for ${pax} ${pax === 1 ? "person" : "people"} ${range}.`;
}

export const quoteDescription = (quote: QuoteDoc, hotel: HotelTemplate) =>
  quote.descriptionEdited ? quote.description : buildDescription(quote, hotel);

export const lineSubtotal = (item: QuoteLineItem, nights: number) => {
  const effectiveNights = item.kind === "other" && item.billingMode === "flat" ? 1 : Math.max(0, nights);
  return +(item.quantity * effectiveNights * item.ratePerNight).toFixed(2);
};

export function quoteTotals(quote: QuoteDoc) {
  let subtotal = 0;
  let tax = 0;
  for (const item of quote.items) {
    const sub = lineSubtotal(item, itemNights(item, quote));
    subtotal += sub;
    if (item.itbms) tax += sub * quote.itbmsRate;
  }
  subtotal = +subtotal.toFixed(2);
  tax = +tax.toFixed(2);
  return { subtotal, tax, total: +(subtotal + tax).toFixed(2) };
}


export const QUOTE_LABELS = {
  es: {
    title: "Cotización de Hospedaje",
    quotationNo: "No.",
    recipient: "Destinatario",
    company: "Empresa",
    guest: "Huésped",
    description: "Descripción",
    name: "Huésped",
    hab: "Hab",
    roomType: "Tipo de habitación",
    roomTypeShort: "Tipo habitación",
    rn: "RN",
    unitPrice: "P/U",
    accommodation: "Acomodación",
    qty: "Cant.",
    nights: "Noches",
    rate: "Tarifa / noche",
    subtotal: "Sub total",
    total: "TOTAL",
    services: "Servicios incluidos",
    hotelInfo: "Información del hotel",
    checkIn: "Check-in",
    checkOut: "Check-out",
  },
  en: {
    title: "Accommodation Quotation",
    quotationNo: "No.",
    recipient: "Recipient",
    company: "Company",
    guest: "Guest",
    description: "Description",
    name: "Guest",
    hab: "Rms",
    roomType: "Room type",
    roomTypeShort: "Room type",
    rn: "RN",
    unitPrice: "U/P",
    accommodation: "Accommodation",
    qty: "Qty",
    nights: "Nights",
    rate: "Rate / night",
    subtotal: "Sub total",
    total: "TOTAL",
    services: "Included services",
    hotelInfo: "Hotel information",
    checkIn: "Check-in",
    checkOut: "Check-out",
  },
} as const;

/** Hotel-specific quotation code prefixes. */
const HOTEL_QUOTE_PREFIX: Record<string, string> = {
  "ac-hotel": "AC",
  "marriott-finisterre": "MEA",
  "residence-inn": "RI",
};

/** Short property code for a hotel (e.g. "RI", "AR", "ER"), used in the
 * internal quote number and the exported file name. */
export function hotelPropertyCode(hotelId: string) {
  return (
    HOTEL_QUOTE_PREFIX[hotelId] ??
    (hotelId.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase() || "QT")
  );
}

/** Quotation number shown in the app and on the PDF, e.g. "AR-482913". */
export function quoteNumber(quote: QuoteDoc) {
  const alphanumeric = quote.id.replace(/[^a-z0-9]/gi, "");
  const numeric = parseInt(alphanumeric, 36).toString().slice(-6).padStart(6, "0");
  return `${hotelPropertyCode(quote.hotelId)}-${numeric}`;
}

/**
 * File name (without extension) for the exported PDF: company plus a guest
 * identifier, suffixed with the property short code and the issue date in
 * DDMMYY format.
 *
 * The second segment is chosen in this priority:
 * 1. quote.guest when it has a value.
 * 2. The first non-empty guestName found in quote.items.
 * 3. quote.recipient as the final fallback.
 *
 * e.g. "Nestle_Carlos_RI_070926" or "Carlos_AC_070926".
 */
export function quoteFileBaseName(quote: QuoteDoc) {
  const cleanSegment = (s: string) =>
    s.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
  const firstGuestName = quote.items.find((item) => item.guestName?.trim())?.guestName ?? "";
  const guestSegment = quote.guest?.trim() || firstGuestName || quote.recipient;
  const nameParts = [cleanSegment(quote.company), cleanSegment(guestSegment)].filter(Boolean);
  const cleanName = nameParts.length > 0 ? nameParts.join("_").toUpperCase() : "COTIZACION";
  const code = hotelPropertyCode(quote.hotelId);
  const { y, m, d } = parts(quote.issueDate);
  const dateStr = `${String(d).padStart(2, "0")}${String(m + 1).padStart(2, "0")}${String(y).slice(-2)}`;
  return `${cleanName}_${code}_${dateStr}`;
}
