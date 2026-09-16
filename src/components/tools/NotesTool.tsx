import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { History, PhoneOff, Save } from "lucide-react";
import { useWorkspace } from "@/workspace/store";
import { extractContact, extractReminder, extractTask } from "@/lib/note-parser";
import {
  CALL_HASHTAGS,
  findActivePropertyCode,
  PROPERTY_STYLES,
} from "@/lib/property-codes";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize-html";
import {
  getNotesBaseFontSize,
  registerNotesEditor,
  subscribeNotesBaseFontSize,
  resetEditorSelection,
  restoreNotesCaret,
  saveNotesCaret,
} from "./notes-format";

import { CallHistoryPanel } from "./CallHistoryPanel";
import { NotesTableOverlay } from "./NotesTableOverlay";

export function NotesTool() {
  const {
    noteText,
    setNoteText,
    callHistory,
    widgets,
    saveNoteToWidget,
    finishCall,
    addReminder,
    addContact,
    addTask,
    addWidgetItem,
  } = useWorkspace();
  const editorRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  /** Plain notes saved into the Notes widget(s), merged into the history panel. */
  const savedNotes = useMemo(
    () =>
      widgets.flatMap((w) => (w.content.kind === "notes" ? w.content.items : [])),
    [widgets],
  );
  const [plain, setPlain] = useState("");
  // --- Keystroke work is deferred so the input event itself stays cheap. ---
  const frameRef = useRef<number | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setNoteTextRef = useRef(setNoteText);
  setNoteTextRef.current = setNoteText;

  /** Push the editor HTML into the store (debounced away from keystrokes). */
  const flushNoteText = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = null;
    const el = editorRef.current;
    if (el) setNoteTextRef.current(el.innerHTML);
  }, []);

  /** Coalesce plain-text derivation into one animation frame. */
  const scheduleUpdate = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setPlain(editorRef.current?.textContent ?? "");
    });
  }, []);

  useEffect(() => {
    const onSelection = () => {
      // Remember where the caret is while the editor has focus, so the
      // position survives unmount/remount (switching tools and back).
      if (document.activeElement === editorRef.current) saveNotesCaret();
      scheduleUpdate();
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, [scheduleUpdate]);

  useEffect(
    () => () => {
      saveNotesCaret();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    },
    [],
  );


  // Toggled action hashtags for the active call — kept purely as UI state,
  // never injected into the note text itself.
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const toggleTag = (tag: string) =>
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  // Keep the DOM in sync only when the incoming value differs (restore/version).
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== noteText) {
      el.innerHTML = noteText;
      setPlain(el.textContent ?? "");
    }
  }, [noteText]);

  useEffect(() => {
    registerNotesEditor(editorRef.current);
    return () => registerNotesEditor(null);
  }, []);

  // The editor owns its base typography: the configured Settings size is
  // applied to the contentEditable root synchronously on every mount (before
  // paint, so there is no initial flash) and re-applied whenever it changes.
  // Explicitly sized spans inside the note still override this.
  useLayoutEffect(() => {
    const apply = (px: number) => {
      const el = editorRef.current;
      if (el) el.style.fontSize = `${px}px`;
    };
    apply(getNotesBaseFontSize());
    return subscribeNotesBaseFontSize(apply);
  }, []);

  // Notes should be ready to type in the moment the tool opens: focus the
  // editor and restore the previous selection (end of content if none).
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;
      if (!restoreNotesCaret(el)) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);


  const activeProperty = useMemo(() => findActivePropertyCode(plain), [plain]);
  const activePropertyStyle = activeProperty
    ? PROPERTY_STYLES[activeProperty.code]
    : null;

  // Clear toggled hashtags whenever the active property code changes (or
  // disappears), so tags never carry over between unrelated calls.
  useEffect(() => {
    setActiveTags(new Set());
  }, [activeProperty?.code]);

  const saveCurrentNote = useCallback(() => {
    const el = editorRef.current;
    if (!el?.textContent?.trim() && !el?.querySelector("img")) return;
    flushNoteText();
    saveNoteToWidget();
    el.innerHTML = "";
    resetEditorSelection(el);
    setPlain("");
  }, [flushNoteText, saveNoteToWidget]);

  /** Paint property-code highlights with the CSS Custom Highlight API (no overlay → caret stays exact). */
  const paintHighlights = useCallback(() => {
    const el = editorRef.current;
    const highlights = (
      CSS as unknown as { highlights?: Map<string, unknown> }
    ).highlights;
    if (!el || !highlights || typeof Highlight === "undefined") return;

    for (const style of Object.values(PROPERTY_STYLES))
      highlights.delete(style.highlightKey);

    // Flatten text nodes with their global offsets.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: { node: Text; start: number }[] = [];
    let offset = 0;
    let n = walker.nextNode() as Text | null;
    while (n) {
      nodes.push({ node: n, start: offset });
      offset += n.data.length;
      n = walker.nextNode() as Text | null;
    }

    const rangeFor = (start: number, end: number): Range | null => {
      const range = document.createRange();
      let placedStart = false;
      let placedEnd = false;
      for (const { node, start: nodeStart } of nodes) {
        const nodeEnd = nodeStart + node.data.length;
        if (!placedStart && start >= nodeStart && start <= nodeEnd) {
          range.setStart(node, start - nodeStart);
          placedStart = true;
        }
        if (placedStart && !placedEnd && end >= nodeStart && end <= nodeEnd) {
          range.setEnd(node, end - nodeStart);
          placedEnd = true;
          break;
        }
      }
      return placedStart && placedEnd ? range : null;
    };

    if (activeProperty && activePropertyStyle) {
      const range = rangeFor(activeProperty.start, activeProperty.end);
      if (range)
        highlights.set(
          activePropertyStyle.highlightKey,
          new Highlight(range as never),
        );
    }
  }, [activeProperty, activePropertyStyle]);

  useEffect(() => {
    paintHighlights();
  }, [paintHighlights]);

  return (
    <div className="-mb-3 flex h-full min-h-0 flex-1 flex-col pb-1 sm:-mb-4">
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div
          ref={paperRef}
          className="notes-paper relative min-h-[280px] flex-1 overflow-y-auto rounded-xl"
          onClick={() => editorRef.current?.focus()}
        >
          
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            suppressHydrationWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Notes"
            spellCheck
            autoCorrect="on"
            autoCapitalize="sentences"
            data-gramm="false"
            onFocus={() => scheduleUpdate()}
            onBlur={() => {
              flushNoteText();
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              const el = e.currentTarget;
              const text = el.textContent ?? "";
              const trimmed = text.trimEnd();
              const isReminder = trimmed.endsWith("*");
              const isContact = trimmed.endsWith("#");
              const isTask = trimmed.endsWith("/");
              if (!isReminder && !isContact && !isTask) return;
              e.preventDefault();

              if (isReminder) {
                const { title, date, time } = extractReminder(text);
                if (!title) return;
                addReminder(title, date, time);
              } else if (isTask) {
                const { title, date, time } = extractTask(text);
                if (!title) return;
                addTask(title, date, time);
              } else {
                const draft = extractContact(text);
                if (!draft.name) return;
                addContact(draft);
              }

              el.innerHTML = "";
              resetEditorSelection(el);
              setPlain("");
              setNoteText("");

            }}

            onPaste={(e) => {
              // Clean external clipboard HTML so dangerous markup never lands
              // in the editor (and thus never gets persisted or re-rendered).
              const html = e.clipboardData.getData("text/html");
              if (!html) return; // plain-text paste is inert; let it through
              e.preventDefault();
              document.execCommand("insertHTML", false, sanitizeHtml(html));
            }}
            onInput={() => {
              scheduleUpdate();
              // Persisting to the store is expensive (whole-workspace save),
              // so it happens once the user pauses instead of per keystroke.
              if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
              syncTimerRef.current = setTimeout(flushNoteText, 400);
            }}
            className="notes-editor min-h-full w-full outline-none"
          />
          <NotesTableOverlay containerRef={paperRef} editorRef={editorRef} />
        </div>

        {showHistory && <CallHistoryPanel entries={callHistory} notes={savedNotes} />}
      </div>

      <footer className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {activePropertyStyle && activeProperty && (
            <button
              onClick={() => {
                const el = editorRef.current;
                if (!el?.textContent?.trim() && !el?.querySelector("img")) return;
                finishCall({
                  html: el.innerHTML,
                  text: plain,
                  property: activeProperty.code,
                  hashtags: Array.from(activeTags),
                });
                el.innerHTML = "";
                resetEditorSelection(el);
                setPlain("");
                setActiveTags(new Set());

              }}
              aria-label="End call"
              title="End call"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-primary-foreground transition-opacity hover:opacity-90"
              style={{ backgroundColor: activePropertyStyle.hex, color: activePropertyStyle.fg }}
            >
              <PhoneOff className="size-[15px]" />
            </button>
          )}
          {activePropertyStyle &&
            CALL_HASHTAGS.map((tag) => {
              const isActive = activeTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggleTag(tag)}
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors hover:opacity-80"
                  style={
                    isActive
                      ? {
                          backgroundColor: activePropertyStyle.hex,
                          color: activePropertyStyle.fg,
                        }
                      : {
                          backgroundColor: `${activePropertyStyle.hex}33`,
                          color: activePropertyStyle.hex,
                        }
                  }
                >
                  {tag}
                </button>
              );
            })}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={saveCurrentNote}
            aria-label="Save note"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Save className="size-[14px]" />
          </button>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            aria-label="Call history"
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-colors hover:bg-secondary hover:text-foreground",
              showHistory ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            <History className="size-[14px]" strokeWidth={2} />
          </button>
        </div>
      </footer>
    </div>
  );
}
