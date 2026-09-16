import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimeFieldProps {
  /** 24h time "HH:MM" (may be empty) */
  value?: string;
  onChange: (value: string) => void;
  className?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];

function split(value?: string) {
  const [hRaw, mRaw] = (value ?? "").split(":");
  const h24 = Number(hRaw);
  if (Number.isNaN(h24) || !hRaw) return { hour: "", minute: "", period: "AM" };
  const period = h24 >= 12 ? "PM" : "AM";
  const hour = String(h24 % 12 === 0 ? 12 : h24 % 12);
  return { hour, minute: (mRaw ?? "00").padStart(2, "0"), period };
}

function join(hour: string, minute: string, period: string) {
  if (!hour) return "";
  let h = Number(hour) % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${(minute || "00").padStart(2, "0")}`;
}

const triggerCls =
  "h-auto rounded-xl border-border bg-surface px-2 py-1 font-mono text-[11px] shadow-none focus:ring-0 focus-visible:border-ring";

export function TimeField({ value, onChange, className }: TimeFieldProps) {
  const { hour, minute, period } = split(value);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Select value={hour} onValueChange={(v) => onChange(join(v, minute, period))}>
        <SelectTrigger aria-label="Hour" className={cn(triggerCls, "w-[3.6rem]")}>
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {HOURS.map((h) => (
            <SelectItem key={h} value={String(h)} className="font-mono text-[12px]">
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-[11px] text-muted-foreground">:</span>
      <Select
        value={minute}
        onValueChange={(v) => onChange(join(hour || "9", v, period))}
      >
        <SelectTrigger aria-label="Minute" className={cn(triggerCls, "w-[3.6rem]")}>
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m} className="font-mono text-[12px]">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={period}
        onValueChange={(v) => onChange(join(hour || "9", minute, v))}
      >
        <SelectTrigger aria-label="AM or PM" className={cn(triggerCls, "w-[3.9rem]")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {["AM", "PM"].map((p) => (
            <SelectItem key={p} value={p} className="font-mono text-[12px]">
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
