import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TextB, CaretDoubleRight, Highlighter, TextItalic, ListBullets, Table } from "@phosphor-icons/react";
import { ImagePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  execNotesCommand,
  insertNotesImage,
  insertNotesTable,
  toggleNotesList,
  applyNotesHighlight,
  restoreNotesSelection,
  saveNotesSelection,
} from "./notes-format";

const COLORS = [
  { label: "Ink", value: "#1c1c1e" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#0f766e" },
  { label: "Amber", value: "#b45309" },
  { label: "Red", value: "#b91c1c" },
  { label: "Violet", value: "#6d28d9" },
];

// Named palette (dot = true hue shown in the list; value = the soft tint
// actually applied as the highlight background, to stay legible on our
// light UI).
const HIGHLIGHTS = [
  { label: "Purple", dot: "#a855f7", value: "#f3e8ff" },
  { label: "Pink", dot: "#ec4899", value: "#fce7f3" },
  { label: "Orange", dot: "#f97316", value: "#ffedd5" },
  { label: "Mint", dot: "#14b8a6", value: "#ccfbf1" },
  { label: "Blue", dot: "#3b82f6", value: "#dbeafe" },
];

const btn =
  "flex size-8 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-desk transition-colors hover:bg-secondary hover:text-foreground";
const activeBtn =
  "bg-[rgba(100,116,139,0.15)] text-slate-700 border-transparent hover:bg-[rgba(100,116,139,0.15)] hover:text-slate-700";

/** Shared staggered scale+fade entrance used by every toolbar button. */
const entrance = (i: number) => ({
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: "spring" as const, stiffness: 400, damping: 25, delay: i * 0.04 },
});

interface NotesToolbarProps {
  visibleCount: number;
}

export function NotesToolbar({ visibleCount }: NotesToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    list: false,
  });

  const syncActive = () => {
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      list: document.queryCommandState("insertUnorderedList"),
    });
  };

  useEffect(() => {
    syncActive();
    document.addEventListener("selectionchange", syncActive);
    return () => document.removeEventListener("selectionchange", syncActive);
  }, []);

  const toggle = (command: "bold" | "italic") => {
    execNotesCommand(command);
    // Reflect the new state immediately so combined bold+italic both stay lit.
    syncActive();
  };

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => insertNotesImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const actions = [
    {
      key: "bold",
      label: "Bold",
      icon: TextB,
      active: active.bold,
      onClick: () => toggle("bold"),
    },
    {
      key: "italic",
      label: "Italic",
      icon: TextItalic,
      active: active.italic,
      onClick: () => toggle("italic"),
    },
    {
      key: "list",
      label: "Bullet list",
      icon: ListBullets,
      active: active.list,
      onClick: () => {
        toggleNotesList();
        syncActive();
      },
    },
    {
      key: "formatting",
      label: "Formatting",
      icon: Highlighter,
      active: false,
      onClick: () => undefined,
    },
  ];
  const visibleActions = actions.slice(0, visibleCount);
  const overflowActions = actions.slice(visibleCount);

  const runOverflowAction = (action: () => void) => {
    setOverflowOpen(false);
    requestAnimationFrame(() => {
      restoreNotesSelection();
      action();
    });
  };

  const formattingPanel = (fromOverflow: boolean) => (
    <div className="w-56 max-w-full space-y-3 p-3">
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Highlight
        </p>
        <div className="grid gap-1">
          {HIGHLIGHTS.map((h) => (
            <button
              key={h.value}
              type="button"
              aria-label={h.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const apply = () => applyNotesHighlight(h.value, h.dot);
                if (fromOverflow) runOverflowAction(apply);
                else apply();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
            >
              <span
                className="size-4 rounded-full border border-border"
                style={{ backgroundColor: h.dot }}
              />
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Text color
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              title={c.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const apply = () => execNotesCommand("foreColor", c.value);
                if (fromOverflow) runOverflowAction(apply);
                else apply();
              }}
              className="size-5 rounded-full border border-border transition-transform hover:scale-110"
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const openPicker = () => fileRef.current?.click();
          if (fromOverflow) runOverflowAction(openPicker);
          else openPicker();
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
      >
        <ImagePlus className="size-[14px]" />
        Insert image
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const insert = () => {
            restoreNotesSelection();
            insertNotesTable();
          };
          if (fromOverflow) runOverflowAction(insert);
          else insert();
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
      >
        <Table size={16} />
        Insert table
      </button>
    </div>
  );

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <AnimatePresence initial={false} mode="popLayout">
        {visibleActions.map((action, index) => {
          const Icon = action.icon;
          if (action.key === "formatting") {
            return (
              <motion.div
                key={action.key}
                layout
                {...entrance(index)}
                exit={{ opacity: 0, scale: 0.75 }}
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={action.label}
                      onMouseDown={(e) => e.preventDefault()}
                      className={btn}
                    >
                      <Icon size={18} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    {formattingPanel(false)}
                  </PopoverContent>
                </Popover>
              </motion.div>
            );
          }

          return (
            <motion.button
              key={action.key}
              layout
              type="button"
              aria-label={action.label}
              aria-pressed={action.active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={action.onClick}
              className={cn(btn, action.active && activeBtn)}
              {...entrance(index)}
              exit={{ opacity: 0, scale: 0.75 }}
            >
              <Icon size={18} />
            </motion.button>
          );
        })}

        {overflowActions.length > 0 && (
          <motion.div
            key="notes-overflow"
            layout
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ duration: 0.16 }}
          >
            <DropdownMenu open={overflowOpen} onOpenChange={setOverflowOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="More notes actions"
                  onPointerDown={saveNotesSelection}
                  className="size-8 rounded-full border-border bg-surface text-muted-foreground shadow-desk hover:bg-secondary hover:text-foreground"
                >
                  <CaretDoubleRight size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-44">
                {overflowActions.map((action) => {
                  const Icon = action.icon;
                  if (action.key === "formatting") {
                    return (
                      <DropdownMenuSub key={action.key}>
                        <DropdownMenuSubTrigger>
                          <Icon size={16} />
                          <span>{action.label}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-auto p-0">
                          {formattingPanel(true)}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  }
                  return (
                    <DropdownMenuItem
                      key={action.key}
                      onSelect={(event) => {
                        event.preventDefault();
                        runOverflowAction(action.onClick);
                      }}
                      className={cn(action.active && "bg-secondary text-foreground")}
                    >
                      <Icon size={16} />
                      <span>{action.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pickImage(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
