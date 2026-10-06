"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { login } from "@/lib/auth";
import { authConfigured } from "@/lib/config";

export default function LoginPage() {
  const { session, ready } = useAuth();
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("/accounts/");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    // Only same-site paths, so the login page can't be used as an open redirect.
    const target = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/accounts/";
    setNext(target);
    if (ready && session) window.location.replace(target);
  }, [ready, session]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3z" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xl font-semibold">SentinelStack</span>
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Scan your AWS accounts for security misconfigurations through a read-only role.
        </p>
        <Button
          className="mt-6 w-full"
          loading={busy}
          onClick={() => {
            setBusy(true);
            void login(next);
          }}
        >
          {authConfigured ? "Sign in with SentinelStack" : "Enter demo mode"}
        </Button>
        {!authConfigured && (
          <p className="mt-3 text-xs text-slate-500">
            Cognito is not configured for this build, so sign-in uses a local demo admin with mock data.
          </p>
        )}
      </div>
    </div>
  );
}
