import { useEffect, useState } from "react";
import { Gear } from "@phosphor-icons/react";
import {
  Check,
  ChevronUp,
  ChevronDown,
  CaseSensitive,
  BookText,
  Terminal,
  Sparkles,
  Lock,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/auth/store";
import { useWorkspace } from "@/workspace/store";
import {
  applyNotesFontFamily,
  applyNotesFontSize,
  getNotesFontFamily,
  getNotesFontSize,
  isNotesSelectionActive,
  restoreNotesSelection,
  saveNotesSelection,
  setNotesBaseFontFamily,
  getNotesBaseFontFamily,
  setNotesBaseFontSize,
  getNotesBaseFontSize,
  DEFAULT_NOTES_FONT_SIZE,
} from "@/components/tools/notes-format";

const FONTS = [
  {
    label: "Inter",
    sub: "System Sans",
    value: "Inter, ui-sans-serif, system-ui, sans-serif",
    icon: CaseSensitive,
  },
  {
    label: "Merriweather",
    sub: "Serif",
    value: "Merriweather, ui-serif, Georgia, serif",
    icon: BookText,
  },
  {
    label: "JetBrains Mono",
    sub: "Monospace",
    value: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    icon: Terminal,
  },
  {
    label: "Poppins",
    sub: "Display Geometric Sans",
    value: "Poppins, ui-sans-serif, system-ui, sans-serif",
    icon: Sparkles,
  },
];

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 96;
const DEFAULT_FONT_SIZE = DEFAULT_NOTES_FONT_SIZE;

/** Matches a computed font-family string back to one of the FONTS presets. */
function matchFont(computed: string | null): string | null {
  if (!computed) return null;
  const lower = computed.toLowerCase();
  for (const f of FONTS) {
    const primary = f.value.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
    if (primary && lower.includes(primary)) return f.value;
  }
  return null;
}

export function SettingsPanel() {
  const { lock } = useAuth();
  const { quote } = useWorkspace();
  const lang = quote.language;
  const [activeFont, setActiveFont] = useState(() => getNotesBaseFontFamily());
  const [fontSize, setFontSize] = useState(() => getNotesBaseFontSize());
  const [sizeInput, setSizeInput] = useState(() => String(getNotesBaseFontSize()));

  useEffect(() => {
    const sync = () => {
      if (isNotesSelectionActive()) setFontSize(getNotesFontSize() ?? DEFAULT_FONT_SIZE);
      const fam = isNotesSelectionActive() ? getNotesFontFamily() : null;
      setActiveFont(matchFont(fam) ?? getNotesBaseFontFamily());
    };
    sync();
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, []);

  useEffect(() => {
    setSizeInput(String(fontSize));
  }, [fontSize]);

  const setSize = (next: number) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, next));
    setFontSize(clamped);
    setNotesBaseFontSize(clamped);
    applyNotesFontSize(clamped);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Settings"
          aria-label="Settings"
          onMouseDown={(e) => {
            saveNotesSelection();
            e.preventDefault();
          }}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-desk transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Gear size={22} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-50 w-60 space-y-3 p-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Font family
          </p>
          <div className="-mx-1 max-h-[300px] divide-y divide-border overflow-y-auto rounded-md border border-border">
            {FONTS.map((f) => {
              const Icon = f.icon;
              const isActive = activeFont === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    restoreNotesSelection();
                    setActiveFont(f.value);
                    setNotesBaseFontFamily(f.value);
                    applyNotesFontFamily(f.value);
                  }}
                  className="flex w-full items-center gap-2 bg-surface px-2.5 py-2 text-left transition-colors hover:bg-secondary"
                >
                  <Icon className="size-[15px] shrink-0 text-muted-foreground" />
                  <span
                    className="flex-1 truncate text-sm text-foreground"
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {`(${f.sub})`}
                    </span>
                  </span>
                  {isActive && <Check className="size-[14px] shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Font size
          </p>
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5">
            <label
              htmlFor="notes-font-size"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Size
            </label>
            <div className="flex items-center gap-1">
              <input
                id="notes-font-size"
                type="number"
                inputMode="numeric"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                value={sizeInput}
                onChange={(e) => setSizeInput(e.target.value)}
                onBlur={() => {
                  const parsed = Number.parseInt(sizeInput, 10);
                  setSize(Number.isFinite(parsed) ? parsed : fontSize);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-12 rounded border border-border bg-background px-1.5 py-0.5 text-right text-sm text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-xs text-muted-foreground">px</span>
              <div className="flex flex-col overflow-hidden rounded border border-border">
                <button
                  type="button"
                  aria-label="Increase font size"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSize(fontSize + 1)}
                  className="flex h-3.5 w-4 items-center justify-center bg-surface text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <ChevronUp className="size-[10px]" />
                </button>
                <button
                  type="button"
                  aria-label="Decrease font size"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSize(fontSize - 1)}
                  className="flex h-3.5 w-4 items-center justify-center border-t border-border bg-surface text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <ChevronDown className="size-[10px]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={lock}
          className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Lock className="size-4" />
          {lang === "es" ? "Bloquear app" : "Lock app"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
