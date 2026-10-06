"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { Spinner } from "./ui";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();

  useEffect(() => {
    if (ready && !session) window.location.replace(`/login/?next=${encodeURIComponent(window.location.pathname)}`);
  }, [ready, session]);

  if (!ready || !session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Checking your session…" />
      </div>
    );
  }
  return <>{children}</>;
}

