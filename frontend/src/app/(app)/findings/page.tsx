"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountPicker, useSelectedAccount } from "@/components/AccountPicker";
import { Drawer } from "@/components/Drawer";
import { FindingDetail } from "@/components/FindingDetail";
import { Button, Card, EmptyState, ErrorBox, PageHeader, SeverityBadge, Spinner, StatusBadge, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { formatRelative, shortResource } from "@/lib/format";
import { FINDING_STATUSES, SERVICES, SEVERITIES, type Finding, type FindingFilters, type Severity } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

const PAGE_SIZE = 10;

const CHIP_ACTIVE: Record<Severity, string> = {
  CRITICAL: "bg-red-600 text-white border-red-600",
  HIGH: "bg-orange-600 text-white border-orange-600",
  MEDIUM: "bg-amber-500 text-white border-amber-500",
  LOW: "bg-slate-600 text-white border-slate-600",
};

export default function FindingsPage() {
  const { accounts, selected, select, error: accountsError } = useSelectedAccount();
  const rules = useAsync(() => api.listRules(), []);
  const [filters, setFilters] = useState<Omit<FindingFilters, "account_id">>({ status: "open" });
  const [search, setSearch] = useState("");
  // Cursor stack: cursors[i] is the cursor that loads page i (page 0 has none).
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Debounce the resource search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === (search || undefined) ? f : { ...f, q: search || undefined }));
      setCursors((c) => (c.length === 1 ? c : [null]));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const page = cursors.length - 1;
  const findings = useAsync(
    () => (selected ? api.listFindings({ ...filters, account_id: selected }, cursors[page], PAGE_SIZE) : Promise.resolve(null)),
    [selected, filters, cursors],
  );

  const ruleById = useMemo(() => new Map((rules.data ?? []).map((r) => [r.rule_id, r])), [rules.data]);

  function setFilter<K extends keyof FindingFilters>(key: K, value: FindingFilters[K] | "") {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    setCursors([null]); // any filter change starts again from the first page
  }

  function selectAccount(accountId: string) {
    select(accountId);
    setCursors([null]);
  }

  function onFindingChanged(updated: Finding) {
    setSelectedFinding(updated);
    void findings.reload();
  }

  return (
    <>
      <PageHeader
        title="Findings"
        description="Misconfigurations found by the latest scans. Click a finding for evidence and an AI-drafted fix."
        actions={accounts && accounts.length > 0 && <AccountPicker accounts={accounts} selected={selected} onSelect={selectAccount} />}
      />

      {accountsError && <ErrorBox message={accountsError} />}
      {accounts && accounts.length === 0 && <EmptyState title="No connected accounts">Connect an account and run a scan to see findings.</EmptyState>}

      {selected && (
        <Card>
          <div className="space-y-3 border-b border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Severity">
              <span className="mr-1 text-xs font-medium text-slate-500">Severity</span>
              {SEVERITIES.map((s) => {
                const active = filters.severity === s;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter("severity", active ? "" : s)}
                    aria-pressed={active}
                    className={cx("rounded-full border px-3 py-1 text-xs font-semibold", active ? CHIP_ACTIVE[s] : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <input className={inputClass} placeholder="Search resource ARN…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search resource" />
              <select className={inputClass} value={filters.service ?? ""} onChange={(e) => setFilter("service", e.target.value as FindingFilters["service"])} aria-label="Service">
                <option value="">All services</option>
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value as FindingFilters["status"])} aria-label="Status">
                <option value="">All statuses</option>
                {FINDING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={filters.rule_id ?? ""} onChange={(e) => setFilter("rule_id", e.target.value)} aria-label="Rule">
                <option value="">All rules</option>
                {(rules.data ?? []).map((r) => (
                  <option key={r.rule_id} value={r.rule_id}>
                    {r.rule_id} — {r.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {findings.loading && !findings.data && <Spinner />}
          {findings.error && (
            <div className="p-4">
              <ErrorBox message={findings.error} onRetry={findings.reload} />
            </div>
          )}
          {findings.data && findings.data.items.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">No findings match these filters.</p>}
          {findings.data && findings.data.items.length > 0 && (
            <div className={cx("overflow-x-auto", findings.loading && "opacity-60")}>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Severity</th>
                    <th className="px-4 py-2 font-medium">Rule</th>
                    <th className="px-4 py-2 font-medium">Resource</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">First seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {findings.data.items.map((f) => (
                    <tr key={f.finding_id} onClick={() => setSelectedFinding(f)} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <SeverityBadge severity={f.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{f.title}</p>
                        <p className="text-xs text-slate-500">
                          {f.rule_id} · {f.service}
                        </p>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-slate-700" title={f.resource_arn}>
                        <button className="text-left hover:underline" onClick={() => setSelectedFinding(f)}>
                          {shortResource(f.resource_arn)}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={f.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatRelative(f.first_seen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {findings.data && (page > 0 || findings.data.next_cursor) && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
              <span className="text-slate-500">Page {page + 1}</span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page === 0} onClick={() => setCursors((c) => c.slice(0, -1))}>
                  Previous
                </Button>
                <Button variant="secondary" disabled={!findings.data.next_cursor} onClick={() => setCursors((c) => [...c, findings.data!.next_cursor])}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Drawer
        open={selectedFinding !== null}
        onClose={() => setSelectedFinding(null)}
        title={
          selectedFinding && (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={selectedFinding.severity} />
                <StatusBadge status={selectedFinding.status} />
              </div>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{selectedFinding.title}</h2>
            </div>
          )
        }
      >
        {selectedFinding && <FindingDetail finding={selectedFinding} rule={ruleById.get(selectedFinding.rule_id)} onChange={onFindingChanged} />}
      </Drawer>
    </>
  );
}
