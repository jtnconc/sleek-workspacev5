import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from "react";
import { hashSecret, verifySecret } from "@/lib/auth-crypto";

const CREDENTIALS_KEY = "reservation-desk-credentials-v1";
const ATTEMPTS_KEY = "reservation-desk-attempts-v1";
const SESSION_KEY = "reservation-desk-session-v1";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

interface StoredCredential {
  username: string;
  salt: string;
  hash: string;
  createdAt: string;
}

interface AttemptRecord {
  failedAttempts: number;
  lockUntil: number | null;
}

type CredentialStore = Record<string, StoredCredential>;
type AttemptStore = Record<string, AttemptRecord>;

const normalize = (username: string) => username.trim().toLowerCase();

function readJson<T>(key: string, storage: Storage, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, storage: Storage, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore (storage disabled / quota) */
  }
}

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "bad-pin"; remainingAttempts?: number }
  | { ok: false; reason: "locked"; lockUntil: number };

export type SetupResult = { ok: true } | { ok: false; reason: "exists" | "invalid" };

interface AuthState {
  status: "loading" | "ready";
  username: string | null;
  hasAnyAccount: boolean;
}

interface AuthApi extends AuthState {
  login: (username: string, pin: string) => Promise<LoginResult>;
  setupPin: (username: string, pin: string) => Promise<SetupResult>;
  lock: () => void;
  getLockInfo: (username: string) => AttemptRecord;
}

const g = globalThis as unknown as { __authCtx?: Context<AuthApi | null> };
const Ctx = g.__authCtx ?? createContext<AuthApi | null>(null);
g.__authCtx = Ctx;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    username: null,
    hasAnyAccount: false,
  });

  useEffect(() => {
    const credentials = readJson<CredentialStore>(CREDENTIALS_KEY, localStorage, {});
    const sessionUser = sessionStorage.getItem(SESSION_KEY);
    const validSession = sessionUser && credentials[normalize(sessionUser)] ? sessionUser : null;
    setState({
      status: "ready",
      username: validSession,
      hasAnyAccount: Object.keys(credentials).length > 0,
    });
  }, []);

  const getLockInfo = useCallback((username: string): AttemptRecord => {
    const attempts = readJson<AttemptStore>(ATTEMPTS_KEY, localStorage, {});
    return attempts[normalize(username)] ?? { failedAttempts: 0, lockUntil: null };
  }, []);

  const setLockInfo = useCallback((username: string, record: AttemptRecord) => {
    const attempts = readJson<AttemptStore>(ATTEMPTS_KEY, localStorage, {});
    attempts[normalize(username)] = record;
    writeJson(ATTEMPTS_KEY, localStorage, attempts);
  }, []);

  const login = useCallback(
    async (usernameRaw: string, pin: string): Promise<LoginResult> => {
      const username = normalize(usernameRaw);
      const now = Date.now();
      const attempt = getLockInfo(username);

      if (attempt.lockUntil && attempt.lockUntil > now) {
        return { ok: false, reason: "locked", lockUntil: attempt.lockUntil };
      }

      const credentials = readJson<CredentialStore>(CREDENTIALS_KEY, localStorage, {});
      const record = credentials[username];
      if (!record) {
        return { ok: false, reason: "not-found" };
      }

      const valid = await verifySecret(pin, record.salt, record.hash);
      if (!valid) {
        const failedAttempts =
          attempt.lockUntil && attempt.lockUntil <= now ? 1 : attempt.failedAttempts + 1;
        const lockUntil = failedAttempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : null;
        setLockInfo(username, { failedAttempts: lockUntil ? 0 : failedAttempts, lockUntil });
        if (lockUntil) return { ok: false, reason: "locked", lockUntil };
        return {
          ok: false,
          reason: "bad-pin",
          remainingAttempts: Math.max(0, MAX_ATTEMPTS - failedAttempts),
        };
      }

      setLockInfo(username, { failedAttempts: 0, lockUntil: null });
      sessionStorage.setItem(SESSION_KEY, record.username);
      setState((s) => ({ ...s, username: record.username }));
      return { ok: true };
    },
    [getLockInfo, setLockInfo],
  );

  const setupPin = useCallback(
    async (usernameRaw: string, pin: string): Promise<SetupResult> => {
      const username = normalize(usernameRaw);
      if (!username || !/^\d{6}$/.test(pin)) {
        return { ok: false, reason: "invalid" };
      }
      const credentials = readJson<CredentialStore>(CREDENTIALS_KEY, localStorage, {});
      if (credentials[username]) {
        return { ok: false, reason: "exists" };
      }
      const { salt, hash } = await hashSecret(pin);
      credentials[username] = {
        username: usernameRaw.trim(),
        salt,
        hash,
        createdAt: new Date().toISOString(),
      };
      writeJson(CREDENTIALS_KEY, localStorage, credentials);
      setLockInfo(username, { failedAttempts: 0, lockUntil: null });
      sessionStorage.setItem(SESSION_KEY, usernameRaw.trim());
      setState((s) => ({ ...s, username: usernameRaw.trim(), hasAnyAccount: true }));
      return { ok: true };
    },
    [setLockInfo],
  );

  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setState((s) => ({ ...s, username: null }));
  }, []);

  const api = useMemo<AuthApi>(
    () => ({ ...state, login, setupPin, lock, getLockInfo }),
    [state, login, setupPin, lock, getLockInfo],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export const AUTH_MAX_ATTEMPTS = MAX_ATTEMPTS;
export const AUTH_LOCKOUT_MS = LOCKOUT_MS;
