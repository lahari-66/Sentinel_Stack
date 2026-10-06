"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ErrorBox, Spinner } from "@/components/ui";
import { handleCallback } from "@/lib/auth";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // The authorization code is single-use; guard against React strict mode running effects twice.
    if (started.current) return;
    started.current = true;
    handleCallback(window.location.search)
      .then((returnTo) => window.location.replace(returnTo))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {error ? (
        <div className="w-full max-w-md space-y-3">
          <ErrorBox message={`Sign-in failed: ${error}`} />
          <Link href="/login/" className="text-sm font-medium text-indigo-600 hover:underline">
            Try again
          </Link>
        </div>
      ) : (
        <Spinner label="Completing sign-in…" />
      )}
    </div>
  );
}
