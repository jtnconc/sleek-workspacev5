import { jsPDF } from "jspdf";
import type { HotelTemplate, QuoteDoc } from "@/workspace/types";
import {
  QUOTE_LABELS,
  buildItemDescription,
  formatDate,
  itemNights,
  lineSubtotal,
  quoteFileBaseName,
  quoteNumber,
  quoteTotals,
} from "./quote-model";

import { money } from "./rates";

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
};

const mix = (rgb: [number, number, number], amount: number): [number, number, number] =>
  rgb.map((c) => Math.round(255 - (255 - c) * amount)) as [number, number, number];

/** Hotel-specific overrides for table header and services card backgrounds. */
const TABLE_HEADER_BG: Record<string, string> = {
  "marriott-finisterre": "#6C5D54",
};
const SERVICE_CARD_BG: Record<string, string> = {
  "marriott-finisterre": "#F6F5F5",
};

const GRAY_COMPANY = hexToRgb("#898989") as [number, number, number];
const headerFill = (hotelId: string, fallback: string) => hexToRgb(TABLE_HEADER_BG[hotelId] ?? fallback);
const servicesFill = (hotelId: string, fallback: string) => hexToRgb(SERVICE_CARD_BG[hotelId] ?? fallback);



/**
 * Real, text-based PDF generation. Isolated from the workspace UI so quotation
 * layouts can evolve per hotel without touching components.
 */
export function buildQuotePdf(quote: QuoteDoc, hotel: HotelTemplate, logoImage?: string) {
  const L = QUOTE_LABELS[quote.language];
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 52;
  const brand = hexToRgb(hotel.accent);
  const secondary = hexToRgb(hotel.secondary ?? hotel.accent);
  const tintSoft = hotel.tint ? hexToRgb(hotel.tint) : mix(brand, 0.07);



  // ---- Header: clean vertical flex-style block (logo → address → divider)
  const headerTop = 36;
  const logo = logoImage ?? hotel.logoUrl;
  let logoDrawn = false;
  let logoH = 0;
  const logoBoxH = 46;
  const logoMaxW = 190;
  let y = headerTop;

  if (logo) {
    try {
      const format = logo.includes("image/png") || logo.endsWith(".png") ? "PNG" : "JPEG";
      const props = doc.getImageProperties(logo);
      const ratio = props.width && props.height ? props.width / props.height : 1;
      let h = logoBoxH;
      let w = h * ratio;
      if (w > logoMaxW) {
        w = logoMaxW;
        h = w / ratio;
      }
      doc.addImage(logo, format, M, y, w, h);
      logoDrawn = true;
      logoH = h;
    } catch {
      logoDrawn = false;
    }
  }

  if (!logoDrawn) {
    // No image available: fall back to the hotel name as plain text.
    doc.setTextColor(22, 26, 34).setFont("helvetica", "bold").setFontSize(13);
    doc.text(doc.splitTextToSize(hotel.name, 300), M, y + 8);
    logoH = 18;
  }

  // Right-aligned header block: a tight vertical stack (date → address) anchored
  // to the bottom of the logo so the whole cluster sits low, close to the divider.
  const rightBlockWidth = 260;
  const logoBottom = y + logoH;

  // Measure the address at its own font size before positioning the cluster.
  const headerAddress = (quote.hotelInfo ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("  ·  ");
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  const addressLines = headerAddress ? doc.splitTextToSize(headerAddress, rightBlockWidth) : [];

  // Tight spacing: minimal baseline-to-baseline gaps between the date and the
  // address lines.
  const addrLineHeight = 9;
  const dateToAddrGap = 18;

  // Anchor the last address baseline to the bottom edge of the logo.
  const addressBottom = logoBottom;
  const addressTop = addressBottom - Math.max(0, addressLines.length - 1) * addrLineHeight;
  const dateY = addressLines.length ? addressTop - dateToAddrGap : logoBottom;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60, 64, 74);
  doc.text(formatDate(quote.issueDate, quote.language), W - M, dateY, { align: "right" });

  let rightBlockBottom = dateY;
  if (addressLines.length) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(115, 120, 132);
    doc.text(addressLines, W - M, addressTop, { align: "right" });
    rightBlockBottom = addressBottom;
  }

  // Pull the divider up close beneath the header cluster.
  y = Math.max(logoBottom, rightBlockBottom) + 6;
  doc.setDrawColor(...mix(brand, 0.35)).setLineWidth(1).line(M, y + 8, W - M, y + 8);
  doc.setLineWidth(0.5);
  y += 8 + 52;


  // ---- Greeting (plain text, no boxed block)
  const greetingLabel =
    quote.language === "es" ? (quote.salutation ?? "Estimado") : "Dear";
  doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(30, 34, 42);
  doc.text(`${greetingLabel} ${quote.recipient || ""}`.trim(), M, y);
  y += 15;
  if (quote.company.trim()) {
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(22, 26, 34);
    doc.text(quote.company, M, y);
    y += 17;
  }
  y += 10;

  // ---- Introduction
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(52, 57, 66);
  const intro = doc.splitTextToSize(quote.intro, W - M * 2);
  doc.text(intro, M, y);
  y += intro.length * 13 + 50;

  // ---- Title
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(22, 26, 34);
  doc.text(L.title, M, y);
  y += 22;

  // ---- Table: DESCRIPCIÓN | NOMBRE | HAB | TIPO HABITACIÓN | RN | P/U | SUB TOTAL
  const tableW = W - M * 2;
  const cols = [
    { label: L.description, x: M + 8, w: 138, align: "left" as const },
    { label: L.name, x: M + 154, w: 66, align: "left" as const },
    { label: L.hab, x: M + 248, w: 26, align: "right" as const },
    { label: L.roomTypeShort, x: M + 258, w: 88, align: "left" as const },
    { label: L.rn, x: M + 370, w: 26, align: "right" as const },
    { label: L.unitPrice, x: M + 420, w: 46, align: "right" as const },
    { label: L.subtotal, x: W - M - 8, w: 58, align: "right" as const },
  ];

  // Header band with only the top corners rounded: jsPDF rounds all four
  // corners, so the bottom half is re-filled with a plain rect to square it.
  doc.setFillColor(...headerFill(hotel.id, hotel.accent));
  doc.roundedRect(M, y, tableW, 22, 5, 5, "F");
  doc.rect(M, y + 11, tableW, 11, "F");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(255, 255, 255);
  cols.forEach((c) => doc.text(c.label.toUpperCase(), c.x, y + 14, { align: c.align }));
  y += 22;

  quote.items.forEach((item, index) => {
    doc.setFont("helvetica", "normal").setFontSize(8);
    const rowNights = itemNights(item, quote);
    const descLines = doc.splitTextToSize(buildItemDescription(item, quote), cols[0]!.w);
    const rowGuest =
      (item.guestName ?? "").trim() ||
      (item.kind === "other" ? "" : quote.language === "es" ? "Por confirmar" : "Pending");
    const nameLines = doc.splitTextToSize(rowGuest, cols[1]!.w);
    const roomLines =
      item.kind === "other" ? [] : doc.splitTextToSize(item.roomType, cols[3]!.w);
    const maxLines = Math.max(descLines.length, nameLines.length, roomLines.length, 1);
    const rowH = Math.max(maxLines * 10 + 14, 26);
    if (index % 2 === 1) doc.setFillColor(250, 250, 249).rect(M, y, tableW, rowH, "F");

    // Helper to vertically center text blocks within the row.
    const lineH = 10;
    const vCenter = (lines: string[]) =>
      y + rowH / 2 - (lines.length - 1) * (lineH / 2) + 2;

    doc.setTextColor(30, 34, 42);
    doc.text(descLines, cols[0]!.x, vCenter(descLines));
    doc.text(nameLines, cols[1]!.x, vCenter(nameLines));
    doc.text(roomLines, cols[3]!.x, vCenter(roomLines));
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    const numY = y + rowH / 2 + 2.5;
    if (item.kind !== "other") {
      doc.text(String(item.quantity), cols[2]!.x, numY, { align: "right" });
    }
    doc.text(String(rowNights), cols[4]!.x, numY, { align: "right" });
    doc.text(money(item.ratePerNight), cols[5]!.x, numY, { align: "right" });
    doc.text(money(lineSubtotal(item, rowNights)), cols[6]!.x, numY, { align: "right" });

    y += rowH;

    doc.setDrawColor(233, 234, 237).line(M, y, W - M, y);
  });


  // ---- Totals
  const { subtotal, tax, total } = quoteTotals(quote);
  y += 16;
  const totalRow = (label: string, value: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9.5);
    doc.setTextColor(bold ? 22 : 80, bold ? 26 : 84, bold ? 34 : 94);
    doc.text(label, W - M - 170, y);
    doc.setFont("helvetica", bold ? "bold" : "normal").setTextColor(22, 26, 34);
    doc.text(money(value), W - M, y, { align: "right" });
    y += 17;
  };
  // A single-row quote already shows its subtotal in the table column.
  if (quote.items.length > 1) totalRow(L.subtotal, subtotal);
  if (tax > 0) totalRow(hotel.taxLabel, tax);
  doc.setDrawColor(...mix(brand, 0.4)).line(W - M - 170, y - 10, W - M, y - 10);
  totalRow(L.total, total, true);


  // ---- Included services, inside a subtle borderless light card
  y += 12;
  doc.setFontSize(9);
  const serviceLines = quote.includedServices
    .filter((s) => s.trim())
    .flatMap((s) => doc.splitTextToSize(`•  ${s}`, tableW - 40));
  const boxH = serviceLines.length * 13 + 44;
  doc.setFillColor(...servicesFill(hotel.id, hotel.tint ?? "#F8F8F8"));
  doc.roundedRect(M, y, tableW, boxH, 8, 8, "F");
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...mix(brand, 0.85));
  doc.text(L.services, M + 20, y + 22);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60, 64, 74);
  doc.text(serviceLines, M + 20, y + 40);
  y += boxH + 26;

  // ---- Hotel information: operational data only (contact + check-in/out).
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(22, 26, 34);
  doc.text(L.hotelInfo, M, y);
  y += 15;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60, 64, 74);
  doc.text(`${L.checkIn} ${quote.checkIn}   ·   ${L.checkOut} ${quote.checkOut}`, M, y);
  y += 28;


  // ---- Footer divider just above the signature block
  doc.setDrawColor(...mix(secondary, 0.4)).setLineWidth(0.8).line(M, y, W - M, y);
  doc.setLineWidth(0.5);
  y += 20;
  const sigLines = quote.signature.split("\n").map((l) => l.trim()).filter(Boolean);
  const emailLines: string[] = [];
  const phoneLines: string[] = [];
  const textLines: string[] = [];
  sigLines.forEach((line) => {
    if (/@/.test(line)) emailLines.push(line);
    else if (/\+?\d[\d\s\-().]{6,}/.test(line)) phoneLines.push(line);
    else textLines.push(line);
  });

  // Agent name: bold and slightly larger.
  if (textLines.length) {
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(22, 26, 34);
    doc.text(textLines[0]!, M, y);
    y += 15;
    // Role / title: regular, soft dark grey.
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(96, 101, 112);
    for (const line of textLines.slice(1)) {
      doc.text(line, M, y);
      y += 12;
    }
  }
  if (emailLines.length || phoneLines.length) {
    y += 2;
    let x = M;
    doc.setFontSize(9);
    emailLines.forEach((line) => {
      doc.setFont("helvetica", "bold").setTextColor(...brand);
      doc.text(line, x, y);
      x += doc.getTextWidth(line) + 18;
    });
    phoneLines.forEach((line) => {
      doc.setFont("helvetica", "normal").setTextColor(60, 64, 74);
      doc.text(line, x, y);
      x += doc.getTextWidth(line) + 18;
    });
    y += 12;
  }

  // Quote code printed faintly in the bottom-right corner of the page.
  const H = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(60, 64, 74);
  const codeLabel = quoteNumber(quote);
  doc.text(codeLabel, W - M, H - 24, { align: "right" });
  doc.restoreGraphicsState();

  return doc;
}

export function generateQuotePdf(quote: QuoteDoc, hotel: HotelTemplate, logoImage?: string) {
  buildQuotePdf(quote, hotel, logoImage).save(`${quoteFileBaseName(quote)}.pdf`);
}

/** Blob URL for an in-place preview of the exact same document. */
export function quotePdfPreviewUrl(quote: QuoteDoc, hotel: HotelTemplate, logoImage?: string) {
  return buildQuotePdf(quote, hotel, logoImage).output("bloburl").toString();
}
