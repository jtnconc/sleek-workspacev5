import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: boolean;
  id?: string;
  "aria-label"?: string;
}

/** Six-box numeric PIN entry with smooth auto-advance between digits. */
export function PinInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
  error,
  id,
  "aria-label": ariaLabel,
}: PinInputProps) {
  return (
    <InputOTP
      id={id}
      maxLength={6}
      value={value}
      onChange={onChange}
      {...(onComplete ? { onComplete } : {})}
      disabled={disabled}
      autoFocus={autoFocus}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      aria-label={ariaLabel}
      containerClassName="justify-center"
    >
      <InputOTPGroup>
        {Array.from({ length: 6 }).map((_, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            mask
            className={cn(
              "h-12 w-10 rounded-xl border border-input bg-surface text-lg font-semibold text-foreground shadow-sm transition-all",
              "first:rounded-l-xl last:rounded-r-xl",
              error && "border-destructive text-destructive ring-1 ring-destructive/40",
            )}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
