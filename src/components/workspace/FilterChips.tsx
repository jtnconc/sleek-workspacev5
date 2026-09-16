import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { WidgetAccent } from "@/workspace/types";
import { accentVar } from "./AccentControl";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface FilterChipOption {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Predefined widget accent this chip's low-opacity wash is derived from. */
  accent: WidgetAccent;
}

/**
 * Generic, reusable multi-select filter-chip row. Mounts/unmounts with a
 * fluid height + fade transition driven by `open`, and — because it renders
 * inside a card that establishes a CSS container-query context — each chip
 * collapses to icon-only once that card gets too narrow to fit its label,
 * falling back to a tooltip for the full name.
 */
export function FilterChips({
  options,
  selected,
  onToggle,
  open,
}: {
  options: FilterChipOption[];
  selected: string[];
  onToggle: (value: string) => void;
  open: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="filter-chips"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <TooltipProvider delayDuration={700}>
            <div
              className="mb-2.5 flex flex-wrap items-center gap-1.5 pt-0.5"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {options.map((opt) => {
                const Icon = opt.icon;
                const isActive = selected.includes(opt.value);
                const wash = accentVar(opt.accent);
                return (
                  <Tooltip key={opt.value}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onToggle(opt.value)}
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        )}
                        style={{
                          backgroundColor: `color-mix(in srgb, ${wash} ${isActive ? 20 : 10}%, transparent)`,
                          borderColor: isActive
                            ? `color-mix(in srgb, ${wash} 45%, transparent)`
                            : "transparent",
                          color: `color-mix(in srgb, ${wash} 75%, var(--foreground))`,
                        }}
                      >
                        <Icon className="size-3 shrink-0" />
                        <span className="hidden @[15rem]:inline">{opt.label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{opt.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
