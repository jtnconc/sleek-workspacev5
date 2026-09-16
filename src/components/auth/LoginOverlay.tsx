import { useEffect, useMemo, useState } from "react";
import { KeyRound, Lock, ShieldAlert, Ticket, User } from "lucide-react";
import { useAuth, AUTH_MAX_ATTEMPTS } from "@/auth/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PinInput } from "@/components/auth/PinInput";
import { cn } from "@/lib/utils";
import { isValidInviteCode } from "@/lib/invite-code";

type Mode = "login" | "setup";

function useCountdown(target: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [target]);
  if (!target) return 0;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

export function LoginOverlay() {
  const { login, setupPin, hasAnyAccount } = useAuth();
  const [mode, setMode] = useState<Mode>(hasAnyAccount ? "login" : "setup");
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lockUntil, setLockUntil] = useState<number | null>(null);

  const secondsLeft = useCountdown(lockUntil);
  const locked = lockUntil !== null && secondsLeft > 0;

  useEffect(() => {
    if (lockUntil && secondsLeft === 0) setLockUntil(null);
  }, [secondsLeft, lockUntil]);

  const resetFields = () => {
    setInviteCode("");
    setPin("");
    setConfirmPin("");
    setError(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    resetFields();
  };

  const canSubmit = useMemo(() => {
    if (pending || locked) return false;
    if (!username.trim() || pin.length !== 6) return false;
    if (mode === "setup" && (confirmPin.length !== 6 || !inviteCode.trim())) return false;
    return true;
  }, [pending, locked, username, pin, confirmPin, inviteCode, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        const result = await login(username, pin);
        if (!result.ok) {
          if (result.reason === "locked") {
            setLockUntil(result.lockUntil);
            setError(`Too many failed attempts (${AUTH_MAX_ATTEMPTS} max). Locked for 60 seconds.`);
          } else if (result.reason === "not-found") {
            setError("No account with that username. Set up a new PIN instead.");
          } else {
            setError(
              result.remainingAttempts !== undefined
                ? `Incorrect PIN. ${result.remainingAttempts} attempt${result.remainingAttempts === 1 ? "" : "s"} remaining.`
                : "Incorrect PIN.",
            );
          }
          setPin("");
        }
      } else {
        if (!isValidInviteCode(inviteCode)) {
          setError("Invalid invite code.");
          setPending(false);
          return;
        }
        if (pin !== confirmPin) {
          setError("PINs don't match. Re-enter both.");
          setConfirmPin("");
          setPending(false);
          return;
        }
        const result = await setupPin(username, pin);
        if (!result.ok) {
          if (result.reason === "exists") {
            setError("That username already has a PIN set up. Log in instead.");
          } else {
            setError("Enter a username and a 6-digit PIN.");
          }
          setPin("");
          setConfirmPin("");
        }
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-7 shadow-lift">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Lock className="size-5" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            {mode === "login" ? "Welcome back" : "Set up your PIN"}
          </h1>
          {mode === "setup" && (
            <p className="text-sm text-muted-foreground">
              Choose a username and a 6-digit PIN to protect this desk.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-username">Username</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="auth-username"
                autoComplete="username"
                placeholder="e.g. front.desk"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={pending || locked}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          {mode === "setup" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-invite">Invite code</Label>
              <div className="relative">
                <Ticket className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="auth-invite"
                  autoComplete="off"
                  placeholder="Enter your invite code"
                  maxLength={64}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  disabled={pending || locked}
                  className="pl-9"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <Label htmlFor="auth-pin" className="self-start">
              {mode === "login" ? "PIN" : "New PIN"}
            </Label>
            <PinInput
              id="auth-pin"
              aria-label="6-digit PIN"
              value={pin}
              onChange={setPin}
              disabled={pending || locked}
              error={!!error && mode === "login"}
            />
          </div>

          {mode === "setup" && (
            <div className="flex flex-col items-center gap-2">
              <Label htmlFor="auth-pin-confirm" className="self-start">
                Confirm PIN
              </Label>
              <PinInput
                id="auth-pin-confirm"
                aria-label="Confirm 6-digit PIN"
                value={confirmPin}
                onChange={setConfirmPin}
                disabled={pending || locked}
                error={!!error}
              />
            </div>
          )}

          {locked ? (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Locked for security. Try again in {secondsLeft}s.</span>
            </div>
          ) : error ? (
            <div
              className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <ShieldAlert className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <Button type="submit" disabled={!canSubmit} className="w-full gap-2">
            <KeyRound className="size-4" />
            {pending ? "Please wait…" : mode === "login" ? "Log In" : "Create PIN"}
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-1 border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">
            {mode === "login" ? "New to this desk?" : "Already have a PIN?"}
          </span>
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "setup" : "login")}
            disabled={pending}
            className={cn(
              "font-medium text-primary underline-offset-4 hover:underline",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {mode === "login" ? "Set Up New PIN" : "Log In"}
          </button>
        </div>
      </div>
    </div>
  );
}
