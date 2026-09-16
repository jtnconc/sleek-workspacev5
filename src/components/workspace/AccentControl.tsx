import { useEffect, useRef, useState } from "react";
import type { WidgetAccent } from "@/workspace/types";
import { cn } from "@/lib/utils";

export const ACCENTS: WidgetAccent[] = [
  "neutral",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
];

export const accentVar = (accent: WidgetAccent = "neutral") => `var(--w-${accent})`;

/** Ultra-light pastel background derived from the accent palette. */
export const tintVar = (accent: WidgetAccent = "neutral") => `var(--w-tint-${accent})`;

/** Inline accent picker: a colored dot that expands into the predefined palette. */
export function AccentControl({
  value = "neutral",
  onChange,
}: {
  value?: WidgetAccent | undefined;
  onChange: (accent: WidgetAccent) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      ref={ref}
      onClick={stop}
      onPointerDown={stop}
      onDragStart={(e) => e.preventDefault()}
      className="flex shrink-0 items-center"
    >
      {open ? (
        <div className="flex items-center gap-1">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              aria-label={a}
              onClick={(e) => {
                e.stopPropagation();
                onChange(a);
                setOpen(false);
              }}
              className={cn(
                "size-[9px] rounded-full transition-transform hover:scale-125",
                a === value && "ring-1 ring-offset-1 ring-foreground/40",
              )}
              style={{ backgroundColor: accentVar(a) }}
            />
          ))}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Widget color"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="flex size-4 items-center justify-center rounded-full"
        >
          <span
            className="size-[5px] rounded-full opacity-70"
            style={{ backgroundColor: accentVar(value) }}
          />
        </button>
      )}
    </div>
  );
}
