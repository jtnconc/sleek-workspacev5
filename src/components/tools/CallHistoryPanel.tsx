import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { CallLogEntry, NoteRefItem } from "@/workspace/types";
import { PROPERTY_STYLES, type PropertyCode } from "@/lib/property-codes";
import { parseEntities, toISODate } from "@/lib/note-parser";
import { sanitizeHtml } from "@/lib/sanitize-html";

/** Unified shape rendered by this panel, built from calls and plain notes. */
interface HistoryEntry {
  id: string;
  text: string;
  html: string;
  hashtags: string[];
  property?: PropertyCode;
  savedAtISO: string;
  savedAt: string;
  source: "call" | "note";
}

interface NotesHistoryPanelProps {
  entries: CallLogEntry[];
  notes?: NoteRefItem[];
}

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

/**
 * Try to read the query as a date. Returns an ISO day (YYYY-MM-DD) or "".
 * Reuses the shared note parsing utilities so relative words ("hoy",
 * "today") and abbreviated formats ("24 sep") behave like everywhere else.
 */
function queryToISODay(query: string): string {
  const direct = toISODate(query);
  if (direct) return direct;
  const entity = parseEntities(query).find((e) => e.type === "date");
  if (entity && entity.value.trim().length === query.trim().length) {
    return toISODate(entity.value);
  }
  return "";
}

/**
 * Sidebar panel showing the full notes history — finished calls plus notes
 * saved from the Notes widget — with a single smart search bar.
 */
export function CallHistoryPanel({ entries, notes = [] }: NotesHistoryPanelProps) {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const merged = useMemo<HistoryEntry[]>(() => {
    const calls: HistoryEntry[] = entries.map((e) => ({
      id: e.id,
      text: e.text,
      html: e.html,
      hashtags: e.hashtags,
      property: e.property,
      savedAtISO: e.savedAtISO,
      savedAt: e.savedAt,
      source: "call",
    }));
    const plain: HistoryEntry[] = notes.map((n) => {
      const iso = n.savedAtISO ?? "";
      return {
        id: n.id,
        text: stripHtml(n.text),
        html: n.text,
        hashtags: [],
        savedAtISO: iso,
        savedAt: iso ? new Date(iso).toLocaleString() : "",
        source: "note",
      };
    });
    return [...calls, ...plain].sort((a, b) => b.savedAtISO.localeCompare(a.savedAtISO));
  }, [entries, notes]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return merged;

    const isoDay = queryToISODay(q);
    if (isoDay) return merged.filter((e) => e.savedAtISO.slice(0, 10) === isoDay);

    if (q.startsWith("#")) {
      const tag = q.slice(1).toLowerCase();
      if (!tag) return merged;
      return merged.filter((e) =>
        e.hashtags.some((h) => h.replace(/^#/, "").toLowerCase().includes(tag)),
      );
    }

    const needle = q.toLowerCase();
    return merged.filter((e) => {
      if (e.text.toLowerCase().includes(needle)) return true;
      if (e.hashtags.some((h) => h.toLowerCase().includes(needle))) return true;
      const label = e.property ? PROPERTY_STYLES[e.property].label : "";
      return !!label && label.toLowerCase().includes(needle);
    });
  }, [merged, query]);

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-border pl-4">
      <p className="label-xs mb-2">Notes History</p>

      <div className="mb-3 flex shrink-0 flex-col gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search date, #tag, name…"
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {!!query.trim() && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="self-start text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear search
          </button>
        )}
      </div>

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="text-[12px] text-muted-foreground">
            {merged.length === 0 ? "Nothing logged yet." : "No results match your search."}
          </li>
        )}
        {filtered.map((e) => {
          const style = e.property ? PROPERTY_STYLES[e.property] : null;
          return (
            <li key={e.id} className="rounded-xl bg-surface-2 p-2.5">
              <div className="flex items-center justify-between gap-2">
                {style ? (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: style.hex, color: style.fg }}
                  >
                    {style.code}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Note
                  </span>
                )}
                {e.savedAt && (
                  <p className="font-mono text-[10.5px] text-muted-foreground">{e.savedAt}</p>
                )}
              </div>
              <div
                className="notes-rich mt-1.5 line-clamp-2 text-[12px]"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.html) }}
              />
              {e.hashtags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {e.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${style?.hex ?? "#888888"}33`,
                        color: style?.hex ?? "#888888",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => setPreview(preview === e.id ? null : e.id)}
                className="mt-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {preview === e.id ? "Hide" : "View"}
              </button>
              {preview === e.id && (
                <div
                  className="notes-rich mt-2 text-[11.5px] leading-snug"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.html) }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
