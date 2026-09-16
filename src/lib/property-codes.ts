/**
 * Call-management branding: recognizes property codes (AR / ER / RI) typed
 * anywhere in a note and drives the contextual hashtag action bar + the
 * "Finish Call" flow in the Notes tool.
 */

export type PropertyCode = "AR" | "ER" | "RI";

export interface PropertyStyle {
  code: PropertyCode;
  label: string;
  /** Exact brand hex used for the in-text badge highlight and the hashtag pills. */
  hex: string;
  /** Readable foreground color against `hex`. */
  fg: string;
  /** Key registered with the CSS Custom Highlight API for this property. */
  highlightKey: string;
}

export const PROPERTY_STYLES: Record<PropertyCode, PropertyStyle> = {
  AR: {
    code: "AR",
    label: "AC Hotel",
    hex: "#71717A",
    fg: "#ffffff",
    highlightKey: "property-ar",
  },
  ER: {
    code: "ER",
    label: "Marriott Executive Apartments",
    hex: "#CE647E",
    fg: "#ffffff",
    highlightKey: "property-er",
  },
  RI: {
    code: "RI",
    label: "Residence Inn",
    hex: "#886671",
    fg: "#ffffff",
    highlightKey: "property-ri",
  },
};

/** Fixed action tags shown once a property code is active in the note. */
export const CALL_HASHTAGS = ["#Reserva", "#Solicitud", "#Consulta", "#Cancelación", "#Cotización"];

export interface ActivePropertyMatch {
  code: PropertyCode;
  /** Offset of the code's first character in the plain-text note. */
  start: number;
  /** Offset right after the code's last character (before the required space). */
  end: number;
}

// Case-insensitive, whole-word match that only "activates" once the code is
// followed by whitespace (i.e. it has been fully typed, not mid-word like "art").
const PROPERTY_RE = /\b(ar|er|ri)\b(?=\s)/i;

/** Finds the first fully-typed property code in `text`, if any. */
export function findActivePropertyCode(text: string): ActivePropertyMatch | null {
  const m = PROPERTY_RE.exec(text);
  if (!m || !m[1]) return null;
  return {
    code: m[1].toUpperCase() as PropertyCode,
    start: m.index,
    end: m.index + m[1].length,
  };
}
