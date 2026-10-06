"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Runs an async loader on mount and whenever deps change; exposes reload() for refetching. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const callId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (id === callId.current) setData(result);
    } catch (e) {
      if (id === callId.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === callId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}
