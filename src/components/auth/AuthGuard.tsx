import type { ReactNode } from "react";
import { useAuth } from "@/auth/store";
import { LoginOverlay } from "@/components/auth/LoginOverlay";

/** Blocks rendering of `children` until a user is authenticated. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { status, username } = useAuth();

  if (status === "loading") {
    return <div className="min-h-screen w-full bg-background" aria-hidden />;
  }

  if (!username) {
    return <LoginOverlay />;
  }

  return <>{children}</>;
}
