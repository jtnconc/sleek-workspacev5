import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Parse an ISO date (YYYY-MM-DD) as a local date to avoid timezone drift. */
export function parseISODate(value?: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function toISO(date: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

const MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function label(value?: string) {
  const d = parseISODate(value);
  if (!d) return null;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

interface DateFieldProps {
  value?: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  /** compact variant used inside widgets */
  size?: "default" | "sm";
  "aria-label"?: string;
}

export function DateField({
  value,
  onChange,
  placeholder = "Select date",
  className,
  size = "default",
  ...rest
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const text = label(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={rest["aria-label"] ?? placeholder}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border border-border bg-surface text-left font-mono outline-none transition-colors hover:border-ring focus-visible:border-ring",
            size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-[13px]",
            !text && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className={size === "sm" ? "size-3 shrink-0" : "size-3.5 shrink-0"} />
          <span className="truncate">{text ?? placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-xl p-0">
        <Calendar
          mode="single"
          selected={parseISODate(value)}
          defaultMonth={parseISODate(value) ?? new Date()}
          onSelect={(d) => {
            if (!d) return;
            onChange(toISO(d));
            setOpen(false);
          }}
          autoFocus
          className="pointer-events-auto p-3 [--cell-size:2rem] [--primary:#1E293B] [--primary-foreground:#ffffff]"
        />
      </PopoverContent>
    </Popover>
  );
}
