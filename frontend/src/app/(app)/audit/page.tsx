"use client";

import { useState } from "react";
import { Button, Card, EmptyState, ErrorBox, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

export default function AuditPage() {
  const first = useAsync(() => api.listAudit(null), []);
  const [more, setMore] = useState<AuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const nextCursor = cursor === undefined ? first.data?.next_cursor ?? null : cursor;
  const entries = [...(first.data?.items ?? []), ...more];

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await api.listAudit(nextCursor);
      setMore((m) => [...m, ...page.items]);
      setCursor(page.next_cursor);
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <PageHeader title="Audit log" description="Who did what in this organisation — account changes, scans, suppressions and settings." />
      {first.loading && !first.data && <Spinner />}
      {first.error && <ErrorBox message={first.error} onRetry={first.reload} />}
      {first.data && entries.length === 0 && <EmptyState title="No activity yet" />}
      {entries.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e, i) => (
                  <tr key={`${e.at}-${i}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(e.at)}</td>
                    <td className="px-4 py-3 text-slate-900">{e.user}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{e.action}</span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-slate-700" title={e.target}>
                      {e.target}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-slate-500" title={JSON.stringify(e.details)}>
                      {Object.keys(e.details).length ? JSON.stringify(e.details) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(nextCursor || moreError) && (
            <div className="border-t border-slate-200 p-4">
              {moreError && <ErrorBox message={moreError} onRetry={loadMore} />}
              {nextCursor && (
                <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                  Load more
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
    </>
  );
}
