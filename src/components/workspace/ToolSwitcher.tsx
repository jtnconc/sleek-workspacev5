import { motion } from "framer-motion";
import { FileText, NotePencil, SealPercent, type IconProps } from "@phosphor-icons/react";
import { useWorkspace } from "@/workspace/store";
import type { ToolId } from "@/workspace/types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TOOLS: { id: ToolId; label: string; Icon: React.ComponentType<IconProps> }[] = [
  { id: "notes", label: "Notes", Icon: NotePencil },
  { id: "quote", label: "Quote", Icon: FileText },
  { id: "rates", label: "Rates", Icon: SealPercent },
];

export function ToolSwitcher() {
  const { activeTool, mode, openTool } = useWorkspace();

  return (
    <TooltipProvider delayDuration={700}>
      <div className="relative flex items-center gap-2 rounded-full border border-border bg-surface p-1 shadow-desk">
        {TOOLS.map((t) => {
          const active = mode === "tool" && activeTool === t.id;
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => openTool(t.id)}
                  aria-label={t.label}
                  className={cn(
                    "relative flex items-center justify-center rounded-full",
                    active ? "h-8 w-11" : "size-8",
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="tool-switcher-pill"
                      className="absolute inset-0 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <t.Icon
                    size={22}
                    className={cn(
                      "relative z-10 transition-colors",
                      active
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
