import { useMemo, useState } from "react";
import { BadgeDollarSign, ChevronDown, Moon, Receipt, Wallet } from "lucide-react";
import { calculateSeniorRate, money } from "@/lib/rates";
import { todayISO } from "@/lib/quote-model";
import { DateRangeField } from "@/components/common/DateRangeField";
import { cn } from "@/lib/utils";



function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-xs">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-center font-mono text-[13px] outline-none transition-colors focus:border-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/** Distinctive highlight for the key "Regular rate" input. */
const rateInputCls = cn(
  inputCls,
  "border-slate-400/40 bg-[rgba(100,116,139,0.15)] font-semibold text-slate-700 focus:border-slate-500",
);

const addDaysISO = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};

export function RatesTool() {
  const today = todayISO();
  const [arrival, setArrival] = useState(today);
  const [departure, setDeparture] = useState(addDaysISO(today, 3));
  const [regularRate, setRegularRate] = useState(0);
  const [paxExtra, setPaxExtra] = useState(0);
  const [paxExtraRate] = useState(25);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const result = useMemo(
    () =>
      calculateSeniorRate({
        arrival,
        departure,
        regularRate,
        paxExtra,
        paxExtraRate,
        taxRate: 0.1,
      }),
    [arrival, departure, regularRate, paxExtra, paxExtraRate],
  );

  const groupedRates = useMemo(() => {
    const groups = new Map<string, { count: number; total: number }>();
    for (const n of result.nights) {
      const g = groups.get(n.ruleLabel) ?? { count: 0, total: 0 };
      g.count += 1;
      g.total += n.rate;
      groups.set(n.ruleLabel, g);
    }
    return Array.from(groups.entries()).map(([label, g]) => ({
      label,
      count: g.count,
      avg: g.count ? g.total / g.count : 0,
    }));
  }, [result.nights]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <DateRangeField
          start={arrival}
          end={departure}
          startLabel="Arrival"
          endLabel="Departure"
          onChange={({ start, end }) => {
            if (start) setArrival(start);
            setDeparture(end ?? "");
          }}
          renderField={(text, control) => (
            <Field key={text} label={text}>
              {control}
            </Field>
          )}
        />

        <Field label="Regular rate">
          <input
            type="number"
            value={regularRate || ""}
            placeholder="0"
            onChange={(e) => setRegularRate(Number(e.target.value))}
            className={cn(rateInputCls, "number-input-clean")}
          />
        </Field>
        <Field label="Pax extra">
          <input
            type="number"
            min={0}
            value={paxExtra || ""}
            placeholder="0"
            onChange={(e) => setPaxExtra(Number(e.target.value))}
            className={cn(inputCls, "number-input-clean")}
          />
        </Field>
        <Field label="Pax extra rate">
          <input
            type="number"
            value={paxExtraRate}
            readOnly
            className={cn(
              inputCls,
              "number-input-clean cursor-default bg-surface-2 text-muted-foreground",
            )}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Rate per night", icon: BadgeDollarSign, value: money(result.avgPerNight), pillClass: "bg-badge-weekday-bg text-badge-weekday-text" },
          { label: "Nights", icon: Moon, value: result.nightCount.toString(), pillClass: "bg-surface-3 text-foreground" },
          { label: "Total stay", icon: Wallet, value: money(result.totalStay), pillClass: "bg-surface-3 text-foreground" },
          { label: "Total + ITBMS", icon: Receipt, value: money(result.totalWithTax), pillClass: "bg-entity-phone/10 text-entity-phone" },
        ].map((s) => (
          <div key={s.label} className="@container rounded-2xl bg-surface-2 p-4">
            <div className="flex flex-col gap-2 @[13rem]:flex-row @[13rem]:items-center @[13rem]:justify-between @[13rem]:gap-2">
              <p className="label-xs flex min-w-0 items-center gap-1">
                <s.icon className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{s.label}</span>
              </p>
              <span
                className={cn(
                  "w-fit self-end rounded-full px-3 py-1.5 font-mono text-[19px] font-bold leading-none tracking-tight @[13rem]:self-auto",
                  s.pillClass,
                )}
              >
                {s.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border">
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="label-xs">View daily</span>
            {!showBreakdown &&
              groupedRates.map((g) => {
                const isWeekday = g.label.includes("Lun-Jue");
                return (
                  <span
                    key={g.label}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1 text-[11px] font-semibold",
                      isWeekday
                        ? "bg-badge-weekday-bg text-badge-weekday-text"
                        : "bg-badge-weekend-bg text-badge-weekend-text",
                    )}
                  >
                    <span className="uppercase tracking-tight">{g.label}</span>
                    <span className="flex items-center gap-0.5">
                      <Moon className="size-3" />
                      {g.count}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 tabular-nums text-white",
                        isWeekday ? "bg-badge-weekday-text" : "bg-badge-weekend-text",
                      )}
                    >
                      {money(g.avg)}
                    </span>
                  </span>
                );
              })}
            {!showBreakdown && groupedRates.length === 0 && (
              <span className="text-[13px] text-muted-foreground">
                Select an arrival and a later departure date.
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              showBreakdown && "rotate-180",
            )}
          />
        </button>

        {showBreakdown && (
          <div className="min-h-0 flex-1 overflow-auto border-t border-border">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  {["Date", "Day", "Discount", "Rate"].map((h) => (
                    <th key={h} className="label-xs px-4 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.nights.map((n) => {
                  const isWeekday = n.ruleLabel.includes("Lun-Jue");
                  return (
                    <tr key={n.date} className="border-t border-border">
                      <td className="px-4 py-2.5 font-mono text-[13px]">{n.date}</td>
                      <td className="px-4 py-2.5 text-[13px]">{n.day}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-tight",
                            isWeekday
                              ? "bg-badge-weekday-bg text-badge-weekday-text"
                              : "bg-badge-weekend-bg text-badge-weekend-text",
                          )}
                        >
                          {n.ruleLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[13px]">{money(n.rate)}</td>
                    </tr>
                  );
                })}
                {result.nights.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                      Select an arrival and a later departure date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
