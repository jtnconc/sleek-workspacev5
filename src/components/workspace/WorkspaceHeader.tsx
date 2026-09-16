import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { FileText } from "lucide-react";
import { widgetIcon, type WidgetIconComponent } from "@/components/workspace/widget-icons";
import { accentVar } from "@/components/workspace/AccentControl";
import { useWorkspace } from "@/workspace/store";
import { SettingsPanel } from "@/components/workspace/SettingsPanel";
import { ToolSwitcher } from "@/components/workspace/ToolSwitcher";
import { NotesToolbar } from "@/components/tools/NotesToolbar";
import { QuoteToolbar } from "@/components/tools/QuoteToolbar";
import type { WidgetType } from "@/workspace/types";
import { quoteNumber } from "@/lib/quote-model";
import { cn } from "@/lib/utils";

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface SearchHit {
  key: string;
  group: string;
  text: string;
  Icon: WidgetIconComponent;
  color?: string;
  onOpen: () => void;
}

interface WorkspaceHeaderProps {
  quotePreview: boolean;
  onToggleQuotePreview: () => void;
  quoteHistoryOpen: boolean;
  onToggleQuoteHistory: () => void;
}

export function WorkspaceHeader({
  quotePreview,
  onToggleQuotePreview,
  quoteHistoryOpen,
  onToggleQuoteHistory,
}: WorkspaceHeaderProps) {
  const {
    mode,
    activeTool,
    widgets,
    openWidget,
    openTool,
    quote,
    quoteHistory,
    loadQuote,
    searchQuery,
    setSearchQuery,
  } = useWorkspace();
  const [searchOpen, setSearchOpen] = useState(false);
  const [visibleToolbarItems, setVisibleToolbarItems] = useState(4);
  const toolbarRowRef = useRef<HTMLDivElement>(null);
  const toolSwitcherRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // When History is open on the Quote tool, the search input filters the
  // History list inline instead of showing the usual results dropdown.
  const suppressDropdown = activeTool === "quote" && quoteHistoryOpen;

  useEffect(() => {
    const row = toolbarRowRef.current;
    const switcher = toolSwitcherRef.current;
    if (!row || !switcher) return;

    const actionCount =
      mode === "tool" && activeTool === "notes"
        ? 4
        : mode === "tool" && activeTool === "quote"
          ? 3
          : 0;

    const recalculate = () => {
      if (actionCount === 0) {
        setVisibleToolbarItems(0);
        return;
      }

      const toolbarWidth = Math.max(0, row.clientWidth - switcher.offsetWidth - 12);
      const actionSize = 32;
      const actionGap = 6;
      const fullWidth = actionCount * actionSize + (actionCount - 1) * actionGap;

      if (fullWidth <= toolbarWidth) {
        setVisibleToolbarItems(actionCount);
        return;
      }

      // Once anything overflows, reserve one action-sized slot for the >> menu.
      const roomBeforeOverflow = toolbarWidth - actionSize - actionGap;
      const fittingActions = Math.floor(
        (roomBeforeOverflow + actionGap) / (actionSize + actionGap),
      );
      setVisibleToolbarItems(Math.max(0, Math.min(actionCount - 1, fittingActions)));
    };

    const observer = new ResizeObserver(recalculate);
    observer.observe(row);
    observer.observe(switcher);
    recalculate();
    const frame = requestAnimationFrame(recalculate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [activeTool, mode, searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  // Leaving the History-filter context (History closes, or the user
  // navigates away from Quote) should drop any leftover query so History
  // doesn't reopen pre-filtered by a stale search.
  useEffect(() => {
    if (!suppressDropdown) setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppressDropdown]);

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!searchWrapRef.current?.contains(target) && !toolbarRowRef.current?.contains(target)) {
        closeSearch();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  // Global search: matches notes, reminders, tasks, contacts, information
  // rows and quotations (current + history).
  const hits = useMemo<SearchHit[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const out: SearchHit[] = [];

    for (const w of widgets) {
      const c = w.content;
      const WIcon = widgetIcon(w.type, w.icon);
      const wColor = accentVar(w.accent);
      const push = (text: string) => {
        const clean = text.trim();
        if (clean && clean.toLowerCase().includes(q))
          out.push({
            key: `${w.id}:${out.length}`,
            group: w.title,
            text: clean,
            Icon: WIcon,
            color: wColor,
            onOpen: () => openWidget(w.id, { fromSearch: true }),
          });
      };
      if (c.kind === "reminders" || c.kind === "tasks") {
        c.items.forEach((i) => push(i.title));
      } else if (c.kind === "contacts") {
        c.items.forEach((i) => {
          const hay = [i.name, i.company, i.email, i.phone].filter(Boolean).join(" · ");
          if (hay.toLowerCase().includes(q)) push(hay);
        });
      } else if (c.kind === "information") {
        c.items.forEach((i) => push(`${i.label} ${i.value}`));
      } else if (c.kind === "notes") {
        c.items.forEach((i) => push(stripHtml(i.text)));
      }
    }

    const docs = [quote, ...quoteHistory.filter((h) => h.id !== quote.id)];
    for (const doc of docs) {
      const hay = [doc.recipient, doc.company, doc.guest, quoteNumber(doc)].join(" ").toLowerCase();
      if (hay.includes(q))
        out.push({
          key: `quote:${doc.id}`,
          group: "Quotes",
          text: `${quoteNumber(doc)} · ${doc.recipient || doc.company || "Quotation"}`,
          Icon: FileText,
          onOpen: () => {
            if (doc.id !== quote.id) loadQuote(doc.id);
            openTool("quote");
          },
        });
    }
    return out.slice(0, 10);
  }, [searchQuery, widgets, quote, quoteHistory, openWidget, openTool, loadQuote]);

  return (
    <header className="relative z-40 w-full shrink-0 bg-transparent">
      <div className="mx-auto flex h-14 w-full max-w-[1240px] flex-row flex-nowrap items-center gap-3 px-5">
        <div
          ref={toolbarRowRef}
          className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden whitespace-nowrap"
        >
          <div ref={toolSwitcherRef} className="shrink-0">
            <ToolSwitcher />
          </div>

          {mode === "tool" && activeTool === "notes" && (
            <NotesToolbar visibleCount={visibleToolbarItems} />
          )}
          {mode === "tool" && activeTool === "quote" && (
            <QuoteToolbar
              visibleCount={visibleToolbarItems}
              preview={quotePreview}
              onTogglePreview={onToggleQuotePreview}
              history={quoteHistoryOpen}
              onToggleHistory={onToggleQuoteHistory}
            />
          )}
        </div>

        <div
          ref={searchWrapRef}
          className="relative z-50 flex shrink-0 items-center overflow-visible"
        >
          <div className="relative flex items-center overflow-visible">
            <div
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-full border border-border bg-surface px-2.5 text-muted-foreground shadow-desk transition-all duration-200 hover:bg-secondary hover:text-foreground",
                searchOpen ? "w-64" : "w-[92px] cursor-pointer",
              )}
              onClick={
                searchOpen
                  ? undefined
                  : () => {
                      setSearchOpen(true);
                      requestAnimationFrame(() => searchInputRef.current?.focus());
                    }
              }
              role={searchOpen ? undefined : "button"}
              tabIndex={searchOpen ? -1 : 0}
              aria-label={searchOpen ? undefined : "Search"}
              onKeyDown={
                searchOpen
                  ? undefined
                  : (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSearchOpen(true);
                        requestAnimationFrame(() => searchInputRef.current?.focus());
                      }
                    }
              }
            >
              {searchOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Close search"
                    onClick={closeSearch}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <MagnifyingGlass size={18} />
                  </button>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchQuery("");
                        searchInputRef.current?.focus();
                      }}
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <MagnifyingGlass size={18} className="shrink-0" />
                  <span className="truncate text-[12px]">Search</span>
                </>
              )}
            </div>

            {!suppressDropdown && searchOpen && searchQuery.trim() && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl border border-border bg-surface p-2 shadow-lg">
                <div className="max-h-72 overflow-y-auto px-1 pb-1 pt-1">
                  {hits.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      No results for &ldquo;{searchQuery.trim()}&rdquo;.
                    </p>
                  ) : (
                    <ul className="space-y-0.5 text-sm">
                      {hits.map((h) => (
                        <li key={h.key}>
                          <button
                            type="button"
                            onClick={() => {
                              h.onOpen();
                              closeSearch();
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary"
                          >
                            <h.Icon
                              className="size-3.5 shrink-0"
                              {...(h.color ? { style: { color: h.color } } : {})}
                            />
                            <span className="min-w-0 flex-1 truncate">{h.text}</span>
                            <span className="label-xs shrink-0">{h.group}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <SettingsPanel />
      </div>
    </header>
  );
}
