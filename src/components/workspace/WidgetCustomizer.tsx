import type { WidgetAccent, WidgetIconName } from "@/workspace/types";
import { cn } from "@/lib/utils";
import { ACCENTS, accentVar, tintVar } from "./AccentControl";
import { WIDGET_ICONS, WIDGET_ICON_NAMES } from "./widget-icons";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * Small customization area integrated inside the widget (no modal / overlay).
 * Opened by clicking the widget icon; lets the user pick icon, accent and
 * — for sticky notes — an ultra-light pastel background tint.
 */
export function WidgetCustomizer({
  icon,
  accent = "neutral",
  tint,
  onIcon,
  onAccent,
  onTint,
}: {
  icon?: WidgetIconName | undefined;
  accent?: WidgetAccent | undefined;
  tint?: WidgetAccent | undefined;
  onIcon: (icon: WidgetIconName) => void;
  onAccent: (accent: WidgetAccent) => void;
  onTint?: ((tint: WidgetAccent) => void) | undefined;
}) {
  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      onDragStart={(e) => e.preventDefault()}
      className="mb-3 space-y-2 rounded-xl bg-surface-2 p-2"
    >
      <div className="flex flex-wrap gap-1">
        {WIDGET_ICON_NAMES.map((name) => {
          const Icon = WIDGET_ICONS[name];
          return (
            <button
              key={name}
              type="button"
              aria-label={name}
              onClick={(e) => {
                e.stopPropagation();
                onIcon(name);
              }}
              className={cn(
                "flex size-6 items-center justify-center rounded-lg transition-colors hover:bg-secondary",
                name === icon && "bg-secondary",
              )}
            >
              <Icon
                size={14}
                style={{ color: name === icon ? accentVar(accent) : undefined }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        {ACCENTS.map((a) => (
          <button
            key={a}
            type="button"
            aria-label={a}
            onClick={(e) => {
              e.stopPropagation();
              onAccent(a);
            }}
            className={cn(
              "size-[10px] rounded-full transition-transform hover:scale-125",
              a === accent && "ring-1 ring-foreground/40 ring-offset-1",
            )}
            style={{ backgroundColor: accentVar(a) }}
          />
        ))}
      </div>
      {onTint && (
        <div className="flex items-center gap-1.5">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              aria-label={`${a} background`}
              onClick={(e) => {
                e.stopPropagation();
                onTint(a);
              }}
              className={cn(
                "size-[14px] rounded-md border border-border transition-transform hover:scale-110",
                a === tint && "ring-1 ring-foreground/40 ring-offset-1",
              )}
              style={{ backgroundColor: tintVar(a) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
