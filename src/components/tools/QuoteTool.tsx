import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { CopySimple, DownloadSimple, Eye, PencilSimple, Trash } from "@phosphor-icons/react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  History,
  ImageUp,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useWorkspace } from "@/workspace/store";
import { HOTELS, getHotel } from "@/lib/hotels";
import {
  QUOTE_LABELS,
  formatDate,
  formatDateShort,
  formatDateTime,
  itemNights,
  lineSubtotal,
  localISODate,
  nightsBetween,
  quoteDescription,
  quoteNumber,
  quoteTotals,
} from "@/lib/quote-model";

import { generateQuotePdf, quotePdfPreviewUrl } from "@/lib/quote-pdf";

const QuotePdfViewer = lazy(() =>
  import("@/components/tools/QuotePdfViewer").then((m) => ({ default: m.QuotePdfViewer })),
);
import { money } from "@/lib/rates";
import type {
  Accommodation,
  HotelTemplate,
  QuoteLineItem,
  Salutation,
} from "@/workspace/types";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { DateField } from "@/components/common/DateField";
import { DateRangeField } from "@/components/common/DateRangeField";
import { SoftSelect } from "@/components/common/SoftSelect";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";



const PAGE_ASPECT = 11 / 8.5;

function PdfSkeleton() {
  return (
    <div
      className="bg-surface-3 animate-pulse rounded-lg"
      style={{ width: "100%", paddingBottom: `${Math.round(PAGE_ASPECT * 100)}%` }}
      aria-label="Loading PDF page"
    />
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none transition-colors focus:border-ring";
const monoInput = cn(inputCls, "tabular-nums");
/** Distinctive highlight for the key rate-per-night input. */
const rateInput = cn(
  monoInput,
  "border-slate-400/40 bg-[rgba(100,116,139,0.15)] font-semibold text-slate-700 focus:border-slate-500",
);
const uid = () => Math.random().toString(36).slice(2, 10);

const STATUS_PILL_CLASS: Record<"new" | "editing" | "duplicated", string> = {
  new: "border-border bg-secondary text-muted-foreground",
  editing: "border-sky-400/30 bg-sky-400/10 text-sky-400",
  duplicated: "border-amber-400/30 bg-amber-400/10 text-amber-400",
};
const STATUS_PILL_LABEL: Record<"new" | "editing" | "duplicated", { en: string; es: string }> = {
  new: { en: "New", es: "Nueva" },
  editing: { en: "Editing", es: "Editando" },
  duplicated: { en: "Duplicated", es: "Duplicada" },
};

const NEUTRAL_HOTEL = {
  id: "",
  name: "",
  address: "",
  accent: "var(--muted-foreground)",
  taxLabel: "ITBMS",
  roomTypes: [],
  accommodations: ["Single", "Double", "Triple", "Quadruple"],
  checkIn: "",
  checkOut: "",
} as unknown as HotelTemplate;

/**
 * Room-type manager keeps a local draft while typing so editing never
 * re-renders the whole quote tree or steals focus. Changes commit on
 * Save, on input blur, or immediately for add/delete.
 */
function RoomTypesManager({
  lang,
  hotelName,
  initial,
  disabled,
  onSave,
  onClose,
}: {
  lang: "es" | "en";
  hotelName: string;
  initial: string[];
  disabled: boolean;
  onSave: (types: string[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState(() => initial.map((name) => ({ id: uid(), name })));

  const commit = (next = rows) =>
    onSave(next.map((r) => r.name.trim()).filter(Boolean));

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-center justify-between">
        <p className="label-xs">
          {lang === "es" ? "Tipos de habitación" : "Room types"} · {hotelName || "—"} ·{" "}
          {lang.toUpperCase()}
        </p>
        <button
          onClick={onClose}
          aria-label="Close room manager"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-2">
            <input
              value={row.name}
              onChange={(e) =>
                setRows((rs) =>
                  rs.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)),
                )
              }
              onBlur={() => commit()}
              className={inputCls}
            />
            <button
              aria-label="Delete room type"
              onClick={() => {
                const next = rows.filter((r) => r.id !== row.id);
                setRows(next);
                commit(next);
              }}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => {
            const next = [
              ...rows,
              { id: uid(), name: lang === "es" ? "Nueva habitación" : "New room type" },
            ];
            setRows(next);
          }}
          disabled={disabled}
          className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Plus className="size-3" />
          {lang === "es" ? "Agregar tipo" : "Add type"}
        </button>
        <button
          onClick={() => {
            commit();
            onClose();
          }}
          disabled={disabled}
          className="rounded-full bg-primary px-3 py-1 text-[11.5px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {lang === "es" ? "Guardar" : "Save"}
        </button>
      </div>
    </div>
  );
}

interface QuoteToolProps {
  showPreview?: boolean;
  showHistory?: boolean;
  onClosePanels?: () => void;
  onTogglePreview?: () => void;
  onShowPreview?: () => void;
}

export function QuoteTool({
  showPreview = false,
  showHistory = false,
  onClosePanels,
  onTogglePreview,
  onShowPreview,
}: QuoteToolProps) {
  const {
    quote,
    updateQuote,
    logQuoteField,
    quoteHistory,
    loadQuote,
    duplicateQuote,
    deleteQuote,
    hotelLogos,
    setHotelLogo,
    hotelDetails,
    hotelRoomTypes,
    setHotelRoomTypes,
    searchQuery,
    showQuoteErrors,
    setShowQuoteErrors,
  } = useWorkspace();
  const selectedHotel = quote.hotelId ? getHotel(quote.hotelId) : null;
  const hotel = selectedHotel ?? NEUTRAL_HOTEL;
  const lang = quote.language;
  const L = QUOTE_LABELS[lang];
  const { subtotal, tax, total } = quoteTotals(quote);
const [showDetails, setShowDetails] = useState(false);
const [showRooms, setShowRooms] = useState(false);
const [collapsedItems, setCollapsedItems] = useState<Set<string>>(() => new Set());
/** History quote id currently awaiting a second tap to confirm deletion. */
 const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
 const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const missingRecipient = showQuoteErrors && !quote.recipient.trim();
  const missingRateIds = useMemo(
    () =>
      new Set(
        quote.items.filter((item) => !item.ratePerNight || item.ratePerNight <= 0).map((i) => i.id),
      ),
    [quote.items],
  );

  // Clear the validation banner as soon as every required field is filled in.
  useEffect(() => {
    if (!showQuoteErrors) return;
    const stillMissing = !quote.recipient.trim() || missingRateIds.size > 0;
    if (!stillMissing) setShowQuoteErrors(false);
  }, [showQuoteErrors, quote.recipient, missingRateIds, setShowQuoteErrors]);

  /**
   * Field-commit change logging. Text inputs update the quote on every
   * keystroke via updateQuote, so we snapshot the value when the field gains
   * focus and log on blur only if it actually changed. Selects/dates commit
   * on selection, so they log directly at the change site.
   */
  const fieldEntryValues = useRef<Record<string, string>>({});
  const captureFieldValue = (key: string) => (e: React.FocusEvent<HTMLInputElement>) => {
    fieldEntryValues.current[key] = e.target.value;
  };
  const commitTextField =
    (field: "company" | "recipient" | "guest") => (e: React.FocusEvent<HTMLInputElement>) => {
      const from = fieldEntryValues.current[field];
      delete fieldEntryValues.current[field];
      if (from !== undefined) logQuoteField(field, from, e.target.value);
    };


// Filters the History list using the shared header search query, mirroring
// the matching logic WorkspaceHeader uses for its own quote search hits.
const filteredHistory = useMemo(() => {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return quoteHistory;
  return quoteHistory.filter((h) => {
    const hay = [h.recipient, h.company, h.guest, quoteNumber(h)].join(" ").toLowerCase();
    return hay.includes(q);
  });
}, [quoteHistory, searchQuery]);

const toggleItem = (itemId: string) => {
  setCollapsedItems((current) => {
    const next = new Set(current);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    return next;
  });
};

  /** Room categories saved for a hotel + language, falling back to defaults. */
  const roomTypesFor = (hotelId: string, l: "es" | "en"): string[] => {
    const saved = hotelRoomTypes[`${hotelId}:${l}`];
    if (saved?.length) return saved;
    return hotelId ? [...getHotel(hotelId).roomTypes] : [];
  };
  const roomTypes = roomTypesFor(quote.hotelId, lang);

  const logo = hotelLogos[quote.hotelId] ?? hotel.logoUrl;
  const description = selectedHotel ? quoteDescription(quote, selectedHotel) : quote.description;

  /** Blob URL of the real generated PDF, rendered inline by pdf.js. */
  const pdfBlobUrl = useMemo(
    () => (showPreview && selectedHotel ? quotePdfPreviewUrl(quote, selectedHotel, logo) : null),
    [showPreview, selectedHotel, quote, logo],
  );
  // Each render of pdfBlobUrl allocates a fresh blob: URL — revoke the previous
  // one whenever it changes (or the component unmounts) so it doesn't leak.
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);


  const saveRoomTypes = (types: string[]) => {
    if (!quote.hotelId) return;
    setHotelRoomTypes(quote.hotelId, lang, types);
    const fallback = types[0] ?? "";
    updateQuote({
      items: quote.items.map((i) => ({
        ...i,
        roomType: types.includes(i.roomType) ? i.roomType : fallback,
      })),
    });
  };


  const patchItem = (id: string, patch: Partial<QuoteLineItem>) =>
    updateQuote({ items: quote.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  /**
   * Each row owns its stay. The first row also syncs the quote-level range so
   * fallbacks (auto description, defaults for new rows) stay coherent.
   */
  const setItemDates = (id: string, patch: { arrival: string; departure: string }) => {
    const items = quote.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    const first = items[0]!;
    const nights = Math.max(1, nightsBetween(first.arrival ?? "", first.departure ?? "") || 1);
    // Date/night changes commit on selection — log the quote-level fields
    // when the first row syncs them.
    if (quote.items[0]?.id === id) {
      logQuoteField("arrival", quote.arrival, patch.arrival);
      logQuoteField("departure", quote.departure, patch.departure);
      logQuoteField("nights", String(quote.nights), String(nights));
    }
    updateQuote({
      items,
      ...(quote.items[0]?.id === id
        ? { arrival: patch.arrival, departure: patch.departure, nights }
        : {}),
    });
  };

  const addItem = (kind: "room" | "other" = "room") => {
    const last = quote.items[quote.items.length - 1];
    const newItemId = uid();
    updateQuote({
      items: [
        ...quote.items,
        {
          id: newItemId,
          kind,
          quantity: 1,
          roomType: kind === "room" ? roomTypes[0] ?? "" : "",
          accommodation: "Single" as Accommodation,
          guestName: "",
          arrival: last?.arrival || quote.arrival,
          departure: last?.departure || quote.departure,
          ratePerNight: 0,
          itbms: true,
        },
      ],
    });
    setCollapsedItems(new Set(quote.items.map((item) => item.id)));
  };


  const removeItem = (id: string) =>
    quote.items.length > 1 && updateQuote({ items: quote.items.filter((i) => i.id !== id) });

  /** Saved details for a hotel + language, falling back to the bundled defaults. */
  const detailsFor = (h: HotelTemplate, l: "es" | "en") =>
    hotelDetails[`${h.id}:${l}`] ?? {
      intro: h[l].intro,
      includedServices: [...h[l].includedServices],
      hotelInfo: h[l].hotelInfo,
      checkIn: h.checkIn,
      checkOut: h.checkOut,
      signature: h[l].signature,
    };

  const switchHotel = (id: string) => {
    if (!id) {
      updateQuote({ hotelId: "" });
      return;
    }
    const h = getHotel(id);
    const d = detailsFor(h, lang);
    const rooms = roomTypesFor(h.id, lang);
    updateQuote({
      hotelId: h.id,
      intro: d.intro,
      includedServices: [...d.includedServices],
      hotelInfo: d.hotelInfo,
      signature: d.signature,
      checkIn: d.checkIn,
      checkOut: d.checkOut,
      items: quote.items.map((i) => ({
        ...i,
        roomType: rooms.includes(i.roomType) ? i.roomType : (rooms[0] ?? ""),
      })),
    });
  };

  const switchLanguage = (next: "es" | "en") => {
    if (next === lang) return;
    const h = selectedHotel;
    if (!h) {
      updateQuote({ language: next });
      return;
    }
    const d = detailsFor(h, next);
    const rooms = roomTypesFor(h.id, next);
    updateQuote({
      language: next,
      intro: d.intro,
      includedServices: [...d.includedServices],
      hotelInfo: d.hotelInfo,
      checkIn: d.checkIn,
      checkOut: d.checkOut,
      signature: d.signature,
      items: quote.items.map((i) => ({
        ...i,
        roomType: rooms.includes(i.roomType) ? i.roomType : (rooms[0] ?? ""),
      })),
    });
  };


  const uploadLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setHotelLogo(quote.hotelId, String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 pr-1">
        <div
          className="grid min-h-0 flex-1 transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: showPreview || showHistory ? "0fr" : "1fr" }}
        >
          <div className="min-h-0 overflow-hidden">
            <article className="min-w-0 h-full overflow-y-auto rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border pb-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="group relative size-10 shrink-0">
                {logo ? (
                  <img
                    src={logo}
                    alt={`${hotel.name} logo`}
                    className="size-10 rounded-xl object-contain"
                  />
                ) : (
                  <div
                    className="flex size-10 items-center justify-center rounded-xl text-[13px] font-semibold text-primary-foreground"
                    style={{ backgroundColor: hotel.accent }}
                  >
                    {hotel.name.slice(0, 1) || "·"}
                  </div>
                )}
                <label
                  title="Upload hotel logo"
                  className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-foreground/45 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <ImageUp className="size-[15px]" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => uploadLogo(e.target.files?.[0])}
                  />
                </label>
                {hotelLogos[quote.hotelId] && (
                  <button
                    aria-label="Remove logo"
                    onClick={() => setHotelLogo(quote.hotelId, null)}
                    className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-surface p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <SoftSelect
                  value={quote.hotelId}
                  onChange={switchHotel}
                  options={HOTELS.map((h) => ({
                    value: h.id,
                    label: h.shortName ?? h.name,
                  }))}
                  aria-label="Hotel"
                  className="w-auto min-w-[180px] max-w-[280px] rounded-full px-3 py-1.5 text-[12px]"
                />
                <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
                  {(["es", "en"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => switchLanguage(l)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] uppercase transition-colors",
                        l === lang
                          ? "bg-[rgba(100,116,139,0.15)] font-medium text-slate-700"
                          : "text-muted-foreground",
                      )}
                    >
                      {l === "es" ? "Español" : "English"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end sm:text-right">
              <DateField
                value={quote.issueDate}
                onChange={(iso) => updateQuote({ issueDate: iso })}
                size="sm"
                aria-label="Issue date"
                className="w-full max-w-[9.5rem]"
              />

              <p className="tabular-nums text-[11px] text-muted-foreground">
                {L.quotationNo} {quoteNumber(quote)}
              </p>
              {quote.status && (
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    STATUS_PILL_CLASS[quote.status],
                  )}
                >
                  {STATUS_PILL_LABEL[quote.status][lang]}
                </span>
              )}
            </div>
          </header>

          <div className="grid gap-3 py-4 sm:grid-cols-2">
            <div className="flex items-end gap-2">
              <label className="flex w-[7.5rem] shrink-0 flex-col gap-1">
                <span className="label-xs">{lang === "es" ? "Tratamiento" : "Treatment"}</span>
                <SoftSelect
                  value={quote.salutation ?? "Estimado"}
                  onChange={(v) => {
                    // Selects commit on selection — log immediately.
                    logQuoteField("salutation", quote.salutation ?? "Estimado", v);
                    updateQuote({ salutation: v as Salutation });
                  }}
                  options={[
                    { value: "Estimado", label: "Estimado" },
                    { value: "Estimada", label: "Estimada" },
                  ]}
                  aria-label={lang === "es" ? "Tratamiento" : "Treatment"}
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="label-xs">{L.recipient}</span>
                <input
                  value={quote.recipient}
                  onChange={(e) => updateQuote({ recipient: e.target.value })}
                  onFocus={captureFieldValue("recipient")}
                  onBlur={commitTextField("recipient")}
                  className={cn(inputCls, missingRecipient && "border-destructive/60 focus-visible:ring-destructive/40")}
                  aria-invalid={missingRecipient}
                />
                {missingRecipient && (
                  <span className="text-[11px] text-destructive">
                    {lang === "es" ? "Falta el destinatario" : "Recipient is required"}
                  </span>
                )}
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="label-xs">{L.company}</span>
              <input
                value={quote.company}
                onChange={(e) => updateQuote({ company: e.target.value })}
                onFocus={captureFieldValue("company")}
                onBlur={commitTextField("company")}
                className={inputCls}
              />
            </label>
          </div>

          <h3 className="text-[15px] font-semibold">{L.title}</h3>


          <div className="mt-4 flex flex-col gap-3">
            {quote.items.map((item, index) => {
              const nights = itemNights(item, quote);
              return (
                <section key={item.id} className="overflow-hidden rounded-xl border border-border bg-surface">
                  {collapsedItems.has(item.id) ? (
                    <div className="flex min-w-0 flex-row items-center gap-2 overflow-x-auto whitespace-nowrap bg-surface-2 px-3 py-2.5">
                      <span className="shrink-0 rounded-full border border-border bg-white px-2.5 py-0.5 text-[12px] font-semibold text-foreground tabular-nums">
                        {item.quantity || 1}{" "}
                        {item.roomType ||
                          (item.kind === "other"
                            ? lang === "es"
                              ? "Sin descripción"
                              : "No description"
                            : "")}
                      </span>
                      {item.kind !== "other" && (
                        <span className="shrink-0 rounded-full border border-border bg-white px-2.5 py-0.5 text-[12px] font-medium text-foreground">
                          {item.accommodation}
                        </span>
                      )}
                      {(item.kind !== "other" || (item.guestName ?? "").trim()) && (
                        <span className="shrink-0 rounded-full border border-border bg-white px-2.5 py-0.5 text-[12px] font-medium text-foreground">
                          {L.guest}: {(item.guestName ?? "").trim() || (lang === "es" ? "Por confirmar" : "Pending")}
                        </span>
                      )}
                      <span className="shrink-0 rounded-full border border-border bg-white px-2.5 py-0.5 text-[12px] font-medium text-foreground tabular-nums">
                        {formatDate(item.arrival || quote.arrival, lang)} →{" "}
                        {formatDate(item.departure || quote.departure, lang)}
                      </span>
                      <span className="shrink-0 rounded-full border border-border bg-white px-2.5 py-0.5 text-[12px] font-semibold text-foreground tabular-nums">
                        {money(lineSubtotal(item, nights))}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        aria-expanded="false"
                        aria-label={lang === "es" ? "Expandir habitación" : "Expand room"}
                        className="ml-auto shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2 bg-surface-2 px-3 py-2.5">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity || ""}
                        onFocus={(event) => event.currentTarget.select()}
                        onClick={(event) => event.currentTarget.select()}
                        onBlur={(event) => {
                          const quantity = Number(event.currentTarget.value);
                          if (!quantity || quantity < 1) {
                            patchItem(item.id, { quantity: 1 });
                          }
                        }}
                        onChange={(event) =>
                          patchItem(item.id, {
                            quantity: event.target.value === "" ? 0 : Number(event.target.value),
                          })
                        }
                        aria-label={L.qty}
                        className={cn(
                          monoInput,
                          "number-input-clean h-8 w-12 shrink-0 px-2 py-1 text-center font-semibold",
                        )}
                      />
                      {item.kind === "other" ? (
                        <input
                          value={item.roomType}
                          onChange={(event) =>
                            patchItem(item.id, { roomType: event.target.value })
                          }
                          placeholder={
                            lang === "es"
                              ? "Descripción (ej. Servicio de Alimentación)"
                              : "Description (e.g. Catering Service)"
                          }
                          aria-label={lang === "es" ? "Descripción" : "Description"}
                          className={cn(inputCls, "h-8 min-w-0 flex-1 py-1 font-semibold")}
                        />
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <SoftSelect
                              value={item.roomType}
                              onChange={(value) => {
                                if (value === "__manage") {
                                  setShowRooms(true);
                                  return;
                                }
                                patchItem(item.id, { roomType: value });
                              }}
                              options={[
                                ...roomTypes.map((room) => ({ value: room, label: room })),
                                {
                                  value: "__manage",
                                  label:
                                    lang === "es"
                                      ? "+ Gestionar/Editar habitaciones"
                                      : "+ Manage/Edit room types",
                                },
                              ]}
                              className="h-8 border-border bg-white px-2 py-1 font-semibold text-foreground shadow-none"
                              aria-label={L.roomType}
                            />
                          </div>
                          <SoftSelect
                            value={item.accommodation}
                            onChange={(value) =>
                              patchItem(item.id, { accommodation: value as Accommodation })
                            }
                            options={hotel.accommodations.map((option) => ({
                              value: option,
                              label: option,
                            }))}
                            className="h-7 w-auto shrink-0 rounded-full border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-foreground"
                            aria-label={L.accommodation}
                          />
                        </>
                      )}
                      <input
                        value={item.guestName ?? ""}
                        onChange={(event) =>
                          patchItem(item.id, { guestName: event.target.value })
                        }
                        placeholder={lang === "es" ? "Huésped" : "Guest Name"}
                        aria-label={L.guest}
                        className={cn(inputCls, "h-8 min-w-0 flex-1 py-1")}
                      />
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        aria-expanded="true"
                        aria-label={lang === "es" ? "Contraer habitación" : "Collapse room"}
                        className="ml-auto shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <ChevronUp className="size-4" />
                      </button>
                    </div>
                  )}

                  {!collapsedItems.has(item.id) && (
                    <div className="flex flex-col gap-2.5 border-t border-border p-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="flex min-w-[15rem] flex-1 items-center gap-2">
                          <DateRangeField
                            size="sm"
                            start={item.arrival || quote.arrival}
                            end={item.departure || quote.departure}
                            startLabel={lang === "es" ? "Llegada" : "Arrival"}
                            endLabel={lang === "es" ? "Salida" : "Departure"}
                            onChange={({ start, end }) =>
                              setItemDates(item.id, {
                                arrival: start ?? item.arrival ?? quote.arrival,
                                departure: end ?? "",
                              })
                            }
                            renderField={(text, control) => (
                              <div key={text} className="contents">
                                <div className="min-w-0 flex-1">{control}</div>
                                {text === (lang === "es" ? "Llegada" : "Arrival") && (
                                  <span
                                    className="shrink-0 text-[12px] text-muted-foreground"
                                    aria-hidden="true"
                                  >
                                    →
                                  </span>
                                )}
                              </div>
                            )}
                          />
                        </div>
                        <label className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                          <input
                            type="number"
                            min={1}
                            value={nights}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => {
                              const n = Math.max(1, Number(event.target.value) || 1);
                              const arrival = item.arrival || quote.arrival;
                              const departureDate = new Date(`${arrival}T00:00:00`);
                              departureDate.setDate(departureDate.getDate() + n);
                              setItemDates(item.id, { arrival, departure: localISODate(departureDate) });
                            }}
                            aria-label={lang === "es" ? "Noches" : "Nights"}
                            className="number-input-clean w-8 bg-transparent text-center tabular-nums"
                          />
                          {lang === "es" ? (nights === 1 ? "noche" : "noches") : nights === 1 ? "night" : "nights"}
                        </label>
                      </div>

                      <div className="flex flex-wrap items-end gap-3 border-t border-border/70 pt-2.5">
                        <label className="flex min-w-[9rem] flex-1 flex-col gap-1 sm:max-w-44">
                          <span className="label-xs">
                            {item.kind === "other" && item.billingMode === "flat"
                              ? lang === "es" ? "Monto" : "Amount"
                              : L.rate}
                          </span>
                          <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[12px] text-muted-foreground">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.ratePerNight || ""}
                              placeholder="0.00"
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(event) =>
                                patchItem(item.id, {
                                  ratePerNight: Number(event.target.value),
                                })
                              }
                              className={cn(
                                rateInput,
                                "number-input-clean h-8 py-1 pl-6",
                                showQuoteErrors &&
                                  missingRateIds.has(item.id) &&
                                  "border-destructive/60 focus-visible:ring-destructive/40",
                              )}
                              aria-invalid={showQuoteErrors && missingRateIds.has(item.id)}
                            />
                          </div>
                          {showQuoteErrors && missingRateIds.has(item.id) && (
                            <span className="text-[11px] text-destructive">
                              {lang === "es" ? "Falta la tarifa" : "Rate is required"}
                            </span>
                          )}
                        </label>
                        <label className="flex shrink-0 flex-col gap-1">
                          <span className="label-xs">ITBMS</span>
                          <span className="flex h-8 items-center">
                            <Switch
                              checked={item.itbms}
                              onCheckedChange={(value) =>
                                patchItem(item.id, { itbms: value })
                              }
                              aria-label="Toggle ITBMS"
                            />
                          </span>
                        </label>
                        {item.kind === "other" && (
                          <label className="flex shrink-0 flex-col gap-1">
                            <span className="label-xs">{lang === "es" ? "Cobro" : "Billing"}</span>
                            <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
                              {(["perNight", "flat"] as const).map((mode) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => patchItem(item.id, { billingMode: mode })}
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                                    (item.billingMode ?? "perNight") === mode
                                      ? "bg-primary text-primary-foreground"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  {mode === "perNight"
                                    ? lang === "es" ? "Por noche" : "Per night"
                                    : lang === "es" ? "Monto total" : "Flat amount"}
                                </button>
                              ))}
                            </div>
                          </label>
                        )}
                        <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
                          <span className="label-xs">{L.subtotal}</span>
                          <span className="flex h-8 items-center tabular-nums text-[14px] font-semibold">
                            {money(lineSubtotal(item, nights))}
                          </span>
                        </div>
                        <div className="flex h-8 items-center">
                          {quote.items.length > 1 && (
                            <button
                              aria-label={`Remove row ${index + 1}`}
                              onClick={() => removeItem(item.id)}
                              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground">
                  <Plus className="size-3" /> {lang === "es" ? "Agregar fila" : "Add row"}
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="rounded-xl border-border bg-popover text-popover-foreground shadow-desk"
              >
                <DropdownMenuItem
                  onSelect={() => addItem("room")}
                  className="cursor-pointer rounded-lg text-[12.5px] focus:bg-secondary focus:text-foreground"
                >
                  {lang === "es" ? "Habitaciones" : "Rooms"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => addItem("other")}
                  className="cursor-pointer rounded-lg text-[12.5px] focus:bg-secondary focus:text-foreground"
                >
                  {lang === "es" ? "Otros" : "Other"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <dl className="w-56 space-y-1.5 text-[13px]">
              {quote.items.length > 1 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{L.subtotal}</dt>
                  <dd className="tabular-nums">{money(subtotal)}</dd>
                </div>
              )}

              {tax > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{hotel.taxLabel}</dt>
                  <dd className="tabular-nums">{money(tax)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                <dt>{L.total}</dt>
                <dd className="tabular-nums">{money(total)}</dd>
              </div>
            </dl>
          </div>

          <div
            className={cn(
              "grid overflow-hidden transition-all duration-300 ease-[var(--ease-desk)]",
              showRooms ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
            aria-hidden={!showRooms}
          >
            <div className="min-h-0">
              <RoomTypesManager
                key={`${quote.hotelId}:${lang}:${showRooms ? "open" : "closed"}`}
                lang={lang}
                hotelName={hotel.name}
                initial={roomTypes}
                disabled={!quote.hotelId}
                onSave={saveRoomTypes}
                onClose={() => setShowRooms(false)}
              />
            </div>
          </div>


          <button
            onClick={() => setShowDetails((v) => !v)}
            className="mt-5 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {showDetails
              ? lang === "es"
                ? "Ocultar detalles"
                : "Hide details"
              : lang === "es"
                ? "Editar detalles"
                : "Edit details"}
          </button>

          {showDetails && (
            <div className="mt-3 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="label-xs">{lang === "es" ? "Introducción" : "Introduction"}</span>
                <textarea
                  value={quote.intro}
                  onChange={(e) => updateQuote({ intro: e.target.value })}
                  rows={3}
                  className={cn(inputCls, "resize-none leading-relaxed")}
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="label-xs">
                  {L.description}{" "}
                  {quote.descriptionEdited
                    ? lang === "es"
                      ? "(editada)"
                      : "(edited)"
                    : lang === "es"
                      ? "(automática)"
                      : "(auto)"}
                </span>
                <textarea
                  value={description}
                  onChange={(e) =>
                    updateQuote({ description: e.target.value, descriptionEdited: true })
                  }
                  rows={2}
                  className={cn(inputCls, "resize-none")}
                />
                {quote.descriptionEdited && (
                  <button
                    onClick={() => updateQuote({ descriptionEdited: false, description: "" })}
                    className="self-start text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {lang === "es" ? "Regenerar automáticamente" : "Regenerate automatically"}
                  </button>
                )}
              </label>
              <label className="flex flex-col gap-1">
                <span className="label-xs">{L.services}</span>
                <textarea
                  value={quote.includedServices.join("\n")}
                  onChange={(e) => updateQuote({ includedServices: e.target.value.split("\n") })}
                  rows={5}
                  className={cn(inputCls, "resize-none leading-relaxed")}
                />
              </label>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="label-xs">{L.hotelInfo}</span>
                  <textarea
                    value={quote.hotelInfo}
                    onChange={(e) => updateQuote({ hotelInfo: e.target.value })}
                    rows={2}
                    className={cn(inputCls, "resize-none")}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="label-xs">{L.checkIn}</span>
                    <input
                      value={quote.checkIn}
                      onChange={(e) => updateQuote({ checkIn: e.target.value })}
                      className={monoInput}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="label-xs">{L.checkOut}</span>
                    <input
                      value={quote.checkOut}
                      onChange={(e) => updateQuote({ checkOut: e.target.value })}
                      className={monoInput}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="label-xs">{lang === "es" ? "Firma" : "Signature"}</span>
                  <textarea
                    value={quote.signature}
                    onChange={(e) => updateQuote({ signature: e.target.value })}
                    rows={3}
                    className={cn(inputCls, "resize-none leading-relaxed")}
                  />
                </label>
              </div>
            </div>
          )}
            </article>
          </div>
        </div>

        <AnimatePresence initial={false} mode="popLayout">
          {showPreview && pdfBlobUrl && (
            <motion.div
              key="quote-preview"
              layout
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ type: "spring", stiffness: 300, damping: 40, mass: 0.9 }}
              className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-muted/30 p-4"
            >
              <ClientOnly fallback={<PdfSkeleton />}>
                <Suspense fallback={<PdfSkeleton />}>
                  <QuotePdfViewer url={pdfBlobUrl} />
                </Suspense>
              </ClientOnly>
            </motion.div>
          )}
        </AnimatePresence>

        {showHistory && (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border p-3">
            <p className="label-xs mb-2">{lang === "es" ? "Historial" : "History"}</p>
          {quoteHistory.length === 0 && (
            <p className="text-[12px] text-muted-foreground">
              {lang === "es"
                ? "Cada PDF generado se archiva aquí."
                : "Each generated PDF is archived here."}
            </p>
          )}
          {quoteHistory.length > 0 && filteredHistory.length === 0 && (
            <p className="text-[12px] text-muted-foreground">
              {lang === "es" ? "Sin resultados." : "No results."}
            </p>
          )}
          <ul className="space-y-2">
            {filteredHistory.map((q) => (
              <li key={q.id + q.updatedAt} className="rounded-xl bg-surface-2 p-2.5">
                {/* Line 1: hotel pill + date */}
                <p className="flex items-center gap-1.5 text-[12.5px]">
                  <span
                    className="shrink-0 truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${getHotel(q.hotelId).accent}1a`,
                      color: getHotel(q.hotelId).accent,
                    }}
                  >
                    {(() => {
                      const h = getHotel(q.hotelId);
                      return h.shortName ?? h.name;
                    })()}
                  </span>
                  <span className="text-muted-foreground">{formatDateShort(q.issueDate)}</span>
                </p>

                {/* Line 2: first room item guest name (fallback recipient) | company */}
                {(() => {
                  const itemGuest = q.items.find((item) => item.guestName?.trim())?.guestName?.trim();
                  const displayName = itemGuest || q.recipient.trim();
                  return (
                    <p className="mt-1 truncate text-[12.5px] font-semibold">
                      {displayName || (lang === "es" ? "Sin destinatario" : "No recipient")}
                      {q.company.trim() && (
                        <span className="font-normal text-foreground/70"> | {q.company}</span>
                      )}
                    </p>
                  );
                })()}

                {/* Line 3: amount (hotel accent) + quote code (muted) + change log toggle */}
                <p
                  className="mt-0.5 flex items-center gap-1 tabular-nums text-[11px] font-medium"
                  style={{ color: getHotel(q.hotelId).accent }}
                >
                  {money(quoteTotals(q).total)} ·{" "}
                  <span className="text-muted-foreground/70">{quoteNumber(q)}</span>
                  {(q.duplicatedFrom || (q.changeLog && q.changeLog.length > 0)) && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedLogId((cur) => (cur === q.id ? null : q.id))
                      }
                      aria-label={lang === "es" ? "Ver historial de cambios" : "View change log"}
                      className="ml-0.5 inline-flex items-center rounded-full p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                    >
                      <History className="size-3" strokeWidth={2} />
                    </button>
                  )}
                </p>
                {expandedLogId === q.id && (
                  <div className="mt-1.5 space-y-1 rounded-lg bg-surface px-2 py-1.5 text-[11px] text-muted-foreground">
                    {q.duplicatedFrom && (
                      <p>
                        {lang === "es" ? "Duplicado de " : "Duplicated from "}
                        <span className="font-medium text-foreground/80">{q.duplicatedFrom}</span>
                      </p>
                    )}
                    {q.changeLog?.map((entry, i) => (
                      <p key={i}>
                        <span className="font-medium text-foreground/80">{entry.label}</span>
                        {": "}
                        {entry.from} → {entry.to}{" "}
                        <span className="text-muted-foreground/60">{formatDateTime(entry.at)}</span>
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <button
                    onClick={() => {
                      loadQuote(q.id);
                      onClosePanels?.();
                    }}
                    aria-label={lang === "es" ? "Abrir cotización" : "Open quote"}
                    className="inline-flex h-7 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button
                    onClick={() => {
                      duplicateQuote(q.id);
                      onClosePanels?.();
                    }}
                    aria-label={lang === "es" ? "Duplicar cotización" : "Duplicate quote"}
                    className="inline-flex h-7 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <CopySimple size={14} />
                  </button>
                  <button
                    onClick={() => {
                      loadQuote(q.id);
                      onShowPreview?.();
                    }}
                    aria-label={lang === "es" ? "Vista previa de cotización" : "Preview quote"}
                    className="inline-flex h-7 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => {
                      const missing = !q.recipient.trim() || q.items.some((item) => !item.ratePerNight || item.ratePerNight <= 0);
                      if (missing) {
                        loadQuote(q.id);
                        setShowQuoteErrors(true);
                        onClosePanels?.();
                        return;
                      }
                      generateQuotePdf(q, getHotel(q.hotelId), hotelLogos[q.hotelId]);
                    }}
                    aria-label={lang === "es" ? "Descargar PDF" : "Download PDF"}
                    className="inline-flex h-7 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <DownloadSimple size={14} />
                  </button>
                  {confirmingDelete === q.id ? (
                    <>
                      <button
                        onClick={() => {
                          deleteQuote(q.id);
                          setConfirmingDelete(null);
                        }}
                        aria-label={lang === "es" ? "Confirmar eliminación" : "Confirm delete"}
                        className="ml-2 inline-flex size-7 items-center justify-center rounded-full border border-destructive/50 bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(null)}
                        aria-label={lang === "es" ? "Cancelar eliminación" : "Cancel delete"}
                        className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmingDelete(q.id)}
                      aria-label={lang === "es" ? "Eliminar cotización" : "Delete quote"}
                      className="ml-2 inline-flex size-7 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          </div>
        )}
      </div>
    </div>
  );
}
