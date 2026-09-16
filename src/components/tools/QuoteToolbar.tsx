import { AnimatePresence, motion } from "framer-motion";
import { CaretDoubleRight, ClockCounterClockwise, DownloadSimple, Eye } from "@phosphor-icons/react";
import { useWorkspace } from "@/workspace/store";
import { getHotel } from "@/lib/hotels";
import { generateQuotePdf } from "@/lib/quote-pdf";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const btn =
  "flex size-8 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-desk transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-surface";
const activeBtn =
  "bg-[rgba(100,116,139,0.15)] text-slate-700 border-transparent hover:bg-[rgba(100,116,139,0.15)] hover:text-slate-700";

interface Props {
  visibleCount: number;
  preview: boolean;
  onTogglePreview: () => void;
  history: boolean;
  onToggleHistory: () => void;
}

export function QuoteToolbar({
  visibleCount,
  preview,
  onTogglePreview,
  history,
  onToggleHistory,
}: Props) {
  const { quote, hotelLogos, archiveQuote, resetQuote, setShowQuoteErrors } = useWorkspace();
  const selected = quote.hotelId ? getHotel(quote.hotelId) : null;

  const download = () => {
    if (!selected) return;
    const missingRecipient = !quote.recipient.trim();
    const missingRate = quote.items.some((item) => !item.ratePerNight || item.ratePerNight <= 0);
    if (missingRecipient || missingRate) {
      setShowQuoteErrors(true);
      return;
    }
    archiveQuote();
    generateQuotePdf(quote, selected, hotelLogos[quote.hotelId] ?? selected.logoUrl);
    // Fresh blank form, ready for the next quotation.
    resetQuote();
  };

  const buttons = [
    {
      key: "preview",
      icon: Eye,
      label: "Preview quotation",
      disabled: !selected,
      onClick: onTogglePreview,
      active: preview,
    },
    {
      key: "download",
      icon: DownloadSimple,
      label: "Download PDF",
      disabled: !selected,
      onClick: download,
      active: false,
    },
    {
      key: "history",
      icon: ClockCounterClockwise,
      label: "Quote history",
      disabled: false,
      onClick: onToggleHistory,
      active: history,
    },
  ];
  const visibleButtons = buttons.slice(0, visibleCount);
  const overflowButtons = buttons.slice(visibleCount);

  return (
    <TooltipProvider delayDuration={700}>
      <div className="flex shrink-0 items-center gap-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {visibleButtons.map((b, index) => (
            <motion.div
              key={b.key}
              layout
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.75 }}
              transition={{ duration: 0.16, delay: index * 0.025 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={b.label}
                    aria-pressed={b.active}
                    disabled={b.disabled}
                    onClick={b.onClick}
                    className={cn(btn, b.active && activeBtn)}
                  >
                    <b.icon size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{b.label}</TooltipContent>
              </Tooltip>
            </motion.div>
          ))}

          {overflowButtons.length > 0 && (
            <motion.div
              key="quote-overflow"
              layout
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.75 }}
              transition={{ duration: 0.16 }}
            >
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="More quotation actions"
                        className="size-8 rounded-full border-border bg-surface text-muted-foreground shadow-desk hover:bg-secondary hover:text-foreground"
                      >
                        <CaretDoubleRight size={18} />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">More actions</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="min-w-48">
                  {overflowButtons.map((b) => (
                    <DropdownMenuItem
                      key={b.key}
                      disabled={b.disabled}
                      onSelect={b.onClick}
                      className={cn(b.active && "bg-secondary text-foreground")}
                    >
                      <b.icon size={16} />
                      <span>{b.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
