import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SoftSelectOption {
  value: string;
  label: string;
}

interface SoftSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SoftSelectOption[];
  className?: string;
  contentClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * App-styled dropdown: light surface, rounded corners, soft desk shadow and
 * dark text — replaces native OS select menus so they match the workspace UI.
 */
export function SoftSelect({
  value,
  onChange,
  options,
  className,
  contentClassName,
  placeholder,
  disabled,
  ...rest
}: SoftSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled ?? false}>
      <SelectTrigger
        aria-label={rest["aria-label"]}
        className={cn(
          "h-auto w-full gap-2 rounded-lg border-border bg-surface px-2.5 py-1.5 text-[13px] font-normal text-foreground shadow-none transition-colors hover:border-ring focus:ring-1 focus:ring-ring [&>svg]:size-3.5 [&>svg]:opacity-60",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className={cn(
          "rounded-xl border-border bg-popover text-popover-foreground shadow-desk",
          contentClassName,
        )}
      >
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            className="cursor-pointer rounded-lg text-[12.5px] focus:bg-secondary focus:text-foreground"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
