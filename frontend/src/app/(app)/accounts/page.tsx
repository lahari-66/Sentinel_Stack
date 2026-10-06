"use client";

import Link from "next/link";
import { useState } from "react";
import { useIsAdmin } from "@/components/AuthProvider";
import { Button, Card, EmptyState, ErrorBox, PageHeader, ScoreBadge, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { Account } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

function AccountCard({ account, onChanged }: { account: Account; onChanged: () => void }) {
  const isAdmin = useIsAdmin();
  const [busy, setBusy] = useState<"scan" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: "scan" | "delete", fn: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-base font-semibold text-slate-900">{account.account_id}</p>
          <p className="mt-0.5 text-xs text-slate-500">{account.region}</p>
        </div>
        <ScoreBadge score={account.last_score} />
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <StatusBadge status={account.status} />
        <span className="text-slate-500">Last scan {formatRelative(account.last_scan_at)}</span>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {account.status === "connected" ? (
          <>
            <Link href={`/findings/?account=${account.account_id}`} className="rounded-md px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50">
              Findings
            </Link>
            <Link href={`/scans/?account=${account.account_id}`} className="rounded-md px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50">
              Scans
            </Link>
            {isAdmin && (
              <Button variant="secondary" className="ml-auto" loading={busy === "scan"} onClick={() => act("scan", () => api.startScan(account.account_id))}>
                Scan now
              </Button>
            )}
          </>
        ) : (
          isAdmin && (
            <Link
              href={`/accounts/new/?account=${account.account_id}&region=${account.region}`}
              className="rounded-md px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              Finish setup
            </Link>
          )
        )}
        {isAdmin && (
          <Button
            variant="ghost"
            className={account.status === "connected" ? "" : "ml-auto"}
            loading={busy === "delete"}
            onClick={() => {
              if (confirm(`Disconnect ${account.account_id}? Its scan schedule stops and its findings are removed.`)) {
                void act("delete", () => api.deleteAccount(account.account_id));
              }
            }}
          >
            Disconnect
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function AccountsPage() {
  const isAdmin = useIsAdmin();
  const { data, error, loading, reload } = useAsync(() => api.listAccounts(), []);

  return (
    <>
      <PageHeader
        title="Accounts"
        description="AWS accounts connected through the read-only SentinelStackScannerRole."
        actions={
          isAdmin && (
            <Link href="/accounts/new/" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Connect account
            </Link>
          )
        }
      />
      {loading && !data && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState title="No accounts connected yet">
          Connect an AWS account to run your first scan. It takes about two minutes.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((a) => (
            <AccountCard key={a.account_id} account={a} onChanged={reload} />
          ))}
        </div>
      )}
    </>
  );
}
