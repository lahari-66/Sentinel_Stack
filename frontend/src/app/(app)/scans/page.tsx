"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountPicker, useSelectedAccount } from "@/components/AccountPicker";
import { useIsAdmin } from "@/components/AuthProvider";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import { Button, Card, EmptyState, ErrorBox, PageHeader, ScoreBadge, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { Scan } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

function Counts({ scan }: { scan: Scan }) {
  const c = scan.counts;
  return (
    <span className="whitespace-nowrap text-xs tabular-nums">
      <span className="font-semibold text-red-700">{c.critical}C</span> · <span className="font-semibold text-orange-700">{c.high}H</span> ·{" "}
      <span className="font-semibold text-amber-700">{c.medium}M</span> · <span className="text-slate-600">{c.low}L</span>
    </span>
  );
}

export default function ScansPage() {
  const isAdmin = useIsAdmin();
  const { accounts, selected, select, error: accountsError } = useSelectedAccount();
  const scans = useAsync(() => (selected ? api.listScans(selected) : Promise.resolve(null)), [selected]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const running = scans.data?.items.some((s) => s.status === "running");
  const reloadScans = scans.reload;

  // Poll while a scan is running; Step Functions usually finishes in under 3 minutes.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void reloadScans(), 5000);
    return () => clearInterval(t);
  }, [running, reloadScans]);

  async function startScan() {
    setStarting(true);
    setStartError(null);
    try {
      await api.startScan(selected);
      await scans.reload();
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  const latest = scans.data?.items.find((s) => s.status === "succeeded");

  return (
    <>
      <PageHeader
        title="Scans"
        description="Every scan runs all 20 rules. Scheduled scans run every 12 hours by default."
        actions={
          accounts &&
          accounts.length > 0 && (
            <>
              <AccountPicker accounts={accounts} selected={selected} onSelect={select} />
              {isAdmin && (
                <Button onClick={startScan} loading={starting} disabled={!selected || running}>
                  {running ? "Scan running…" : "Scan now"}
                </Button>
              )}
            </>
          )
        }
      />

      {accountsError && <ErrorBox message={accountsError} />}
      {startError && (
        <div className="mb-4">
          <ErrorBox message={startError} />
        </div>
      )}
      {accounts && accounts.length === 0 && (
        <EmptyState title="No connected accounts">
          <Link href="/accounts/new/" className="font-medium text-indigo-600 hover:underline">
            Connect an AWS account
          </Link>{" "}
          to start scanning.
        </EmptyState>
      )}

      {selected && (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-4">
              <ScoreBadge score={latest?.score ?? null} size="lg" />
              <div>
                <p className="text-sm font-medium text-slate-900">Posture score</p>
                <p className="text-xs text-slate-500">100 − (20×critical + 10×high + 4×medium + 1×low), suppressed findings excluded.</p>
              </div>
            </div>
            {scans.data && <ScoreTrendChart scans={scans.data.items} />}
          </Card>

          <Card>
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="font-medium text-slate-900">History</h2>
            </div>
            {scans.loading && !scans.data && <Spinner />}
            {scans.error && (
              <div className="p-5">
                <ErrorBox message={scans.error} onRetry={scans.reload} />
              </div>
            )}
            {scans.data && scans.data.items.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">No scans yet. Click “Scan now”.</p>}
            {scans.data && scans.data.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-2 font-medium">Started</th>
                      <th className="px-5 py-2 font-medium">Status</th>
                      <th className="px-5 py-2 font-medium">Trigger</th>
                      <th className="px-5 py-2 font-medium">Duration</th>
                      <th className="px-5 py-2 font-medium">Score</th>
                      <th className="px-5 py-2 font-medium">Open findings</th>
                      <th className="px-5 py-2 font-medium">New / resolved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scans.data.items.map((s) => (
                      <tr key={s.scan_id}>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-900">{formatDateTime(s.started_at)}</td>
                        <td className="px-5 py-3">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-5 py-3 capitalize text-slate-600">{s.trigger}</td>
                        <td className="px-5 py-3 tabular-nums text-slate-600">{formatDuration(s.started_at, s.finished_at)}</td>
                        <td className="px-5 py-3 font-semibold tabular-nums">{s.score ?? "—"}</td>
                        <td className="px-5 py-3">{s.status === "succeeded" ? <Counts scan={s} /> : "—"}</td>
                        <td className="px-5 py-3 tabular-nums">
                          <span className="text-red-700">+{s.new}</span> / <span className="text-emerald-700">−{s.resolved}</span>
                          {s.rule_errors.length > 0 && (
                            <span className="ml-2 text-xs text-amber-700" title={s.rule_errors.join(", ")}>
                              {s.rule_errors.length} rule error(s)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
