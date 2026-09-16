"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

const MONTH_LABELS_ES = [
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

const YEAR_GRID_SPAN = 12;

function MonthYearCaption({
  month,
  view,
  onToggleView,
}: {
  month: Date;
  view: "days" | "months" | "years";
  onToggleView: (view: "days" | "months" | "years") => void;
}) {
  return (
    <div className="flex h-(--cell-size) w-full items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onToggleView(view === "months" ? "days" : "months")}
        aria-expanded={view === "months"}
        className={cn(
          "select-none rounded-full border border-transparent px-3 py-1 text-sm font-medium capitalize transition-colors hover:border-border hover:bg-accent hover:text-accent-foreground",
          view === "months" && "border-primary/30 bg-primary/10 text-primary",
        )}
      >
        {month.toLocaleString("es", { month: "long" })}
      </button>
      <button
        type="button"
        onClick={() => onToggleView(view === "years" ? "days" : "years")}
        aria-expanded={view === "years"}
        className={cn(
          "select-none rounded-full border border-transparent px-3 py-1 text-sm font-medium transition-colors hover:border-border hover:bg-accent hover:text-accent-foreground",
          view === "years" && "border-primary/30 bg-primary/10 text-primary",
        )}
      >
        {month.getFullYear()}
      </button>
    </div>
  );
}

function MonthYearPickerPopup({
  month,
  view,
  yearPage,
  onShiftYears,
  onClose,
  onPickMonth,
  onPickYear,
}: {
  month: Date;
  view: "months" | "years";
  yearPage: number;
  onShiftYears: (delta: number) => void;
  onClose: () => void;
  onPickMonth: (index: number) => void;
  onPickYear: (year: number) => void;
}) {
  const startYear =
    month.getFullYear() - Math.floor(YEAR_GRID_SPAN / 2) + yearPage * YEAR_GRID_SPAN;
  const years = Array.from({ length: YEAR_GRID_SPAN }, (_, i) => startYear + i);

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar selector"
        onClick={onClose}
        className="absolute inset-x-0 top-11 bottom-0 z-40 cursor-default rounded-2xl bg-background/60"
        tabIndex={-1}
      />
      <div
        className="absolute inset-x-0 top-11 z-50 mx-auto w-56 rounded-2xl border border-border bg-card p-2 shadow-xl"
        role="dialog"
      >
        {view === "months" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_LABELS_ES.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => onPickMonth(index)}
                className={cn(
                  "select-none rounded-xl px-2 py-2 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  index === month.getMonth() &&
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                aria-label="Años anteriores"
                onClick={() => onShiftYears(-1)}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <span className="text-xs font-semibold text-muted-foreground">
                {years[0]} – {years[years.length - 1]}
              </span>
              <button
                type="button"
                aria-label="Años siguientes"
                onClick={() => onShiftYears(1)}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => onPickYear(year)}
                  className={cn(
                    "select-none rounded-xl px-2 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                    year === month.getFullYear() &&
                      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}


function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  month: monthProp,
  defaultMonth,
  onMonthChange,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  const [month, setMonth] = React.useState<Date>(monthProp ?? defaultMonth ?? new Date());
  const [view, setViewState] = React.useState<"days" | "months" | "years">("days");
  const [yearPage, setYearPage] = React.useState(0);

  const setView = (next: "days" | "months" | "years") => {
    if (next !== "years") setYearPage(0);
    setViewState(next);
  };

  const currentMonth = monthProp ?? month;

  const handleMonthChange = (next: Date) => {
    setMonth(next);
    onMonthChange?.(next);
  };

  const pickMonth = (index: number) => {
    handleMonthChange(new Date(currentMonth.getFullYear(), index, 1));
    setView("days");
  };

  const pickYear = (year: number) => {
    handleMonthChange(new Date(year, currentMonth.getMonth(), 1));
    setView("months");
  };

  return (
    <div className="relative">
      {view !== "days" && (
        <MonthYearPickerPopup
          month={currentMonth}
          view={view}
          yearPage={yearPage}
          onShiftYears={(delta) => setYearPage((p) => p + delta)}
          onClose={() => setView("days")}
          onPickMonth={pickMonth}
          onPickYear={pickYear}
        />
      )}

      <DayPicker
      showOutsideDays={showOutsideDays}
      month={currentMonth}
      onMonthChange={handleMonthChange}
      className={cn(
        "bg-background group/calendar rounded-2xl p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          // The nav row is absolutely positioned across the whole caption area, so it
          // paints above the (statically positioned) caption and would swallow clicks
          // on the month/year labels. Let clicks pass through the empty middle.
          "pointer-events-none absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "pointer-events-auto h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "pointer-events-auto h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "relative z-10 flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption,
        ),

        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("bg-popover absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday,
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn("w-(--cell-size) select-none", defaultClassNames.week_number_header),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day,
        ),
        range_start: cn("bg-accent rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
          }

          if (orientation === "right") {
            return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
          }

          return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        MonthCaption: () => (
          <MonthYearCaption month={currentMonth} view={view} onToggleView={setView} />
        ),
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
      />
    </div>
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers["focused"]) ref.current?.focus();
  }, [modifiers]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers["selected"] &&
        !modifiers["range_start"] &&
        !modifiers["range_end"] &&
        !modifiers["range_middle"]
      }
      data-range-start={modifiers["range_start"]}
      data-range-end={modifiers["range_end"]}
      data-range-middle={modifiers["range_middle"]}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
