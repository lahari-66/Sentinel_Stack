"use client";

import { useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Explanation, Finding, Rule } from "@/lib/types";
import { useIsAdmin } from "./AuthProvider";
import { Button, ErrorBox, inputClass } from "./ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

/** Evidence is untrusted data from the customer's account: rendered as text only, never as HTML. */
function Evidence({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence);
  if (entries.length === 0) return <p className="text-sm text-slate-500">No evidence recorded.</p>;
  return (
    <dl className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-3 gap-3 px-3 py-2">
          <dt className="font-medium text-slate-600">{key.replace(/_/g, " ")}</dt>
          <dd className="col-span-2 break-all font-mono text-xs text-slate-900">
            {typeof value === "object" && value !== null ? (
              <pre className="whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
            ) : (
              String(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <button
          className="text-xs font-medium text-indigo-600 hover:underline"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">{code}</pre>
    </div>
  );
}

function ExplainPanel({ finding }: { finding: Finding }) {
  const [result, setResult] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.explain(finding.finding_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">Explain &amp; draft fix</p>
        {!result && (
          <Button onClick={run} loading={loading}>
            {loading ? "Generating…" : "Explain"}
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs font-medium text-amber-700">AI-drafted proposal — review before applying.</p>
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} onRetry={run} />
        </div>
      )}
      {result && (
        <div className="mt-4 space-y-4 text-sm text-slate-800">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">What is wrong</p>
            <p className="whitespace-pre-wrap">{result.explanation}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Impact</p>
            <p className="whitespace-pre-wrap">{result.impact}</p>
          </div>
          <CodeBlock label="AWS CLI fix" code={result.cli_fix} />
          <CodeBlock label="CloudFormation fix" code={result.cloudformation_fix} />
          <p className="text-xs text-slate-500">
            {result.cached ? "Cached" : "Generated"} {formatDateTime(result.generated_at)} · model {result.model}
          </p>
        </div>
      )}
    </div>
  );
}

function SuppressControl({ finding, onChange }: { finding: Finding; onChange: (f: Finding) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<Finding>) {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (finding.status === "suppressed") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-700">
          Suppressed by <span className="font-medium">{finding.suppressed?.by}</span> on {formatDateTime(finding.suppressed?.at)}:{" "}
          <span className="italic">“{finding.suppressed?.reason}”</span>
        </p>
        <Button variant="secondary" loading={busy} onClick={() => act(() => api.unsuppress(finding.finding_id))}>
          Unsuppress
        </Button>
        {error && <ErrorBox message={error} />}
      </div>
    );
  }
  if (finding.status !== "open") return null;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void act(() => api.suppress(finding.finding_id, reason.trim()));
      }}
    >
      <input
        className={inputClass}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required) — e.g. accepted risk, tracked in ticket SEC-42"
        maxLength={300}
      />
      <Button type="submit" variant="secondary" loading={busy} disabled={reason.trim().length < 3}>
        Suppress finding
      </Button>
      <p className="text-xs text-slate-500">Suppressed findings are excluded from the score and recorded in the audit log.</p>
      {error && <ErrorBox message={error} />}
    </form>
  );
}

export function FindingDetail({ finding, rule, onChange }: { finding: Finding; rule?: Rule; onChange: (f: Finding) => void }) {
  const isAdmin = useIsAdmin();
  return (
    <div>
      <Section title="Resource">
        <p className="break-all font-mono text-sm text-slate-900">{finding.resource_arn}</p>
        <p className="mt-1 text-xs text-slate-500">Account {finding.account_id}</p>
      </Section>

      {rule && (
        <Section title={`Rule ${rule.rule_id}`}>
          <p className="text-sm text-slate-700">{rule.description}</p>
        </Section>
      )}

      <Section title="Evidence">
        <Evidence evidence={finding.evidence} />
      </Section>

      <Section title="Timeline">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">First seen</dt>
            <dd className="text-slate-900">{formatDateTime(finding.first_seen)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Last seen</dt>
            <dd className="text-slate-900">{formatDateTime(finding.last_seen)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Resolved</dt>
            <dd className="text-slate-900">{formatDateTime(finding.resolved_at)}</dd>
          </div>
        </dl>
      </Section>

      <Section title="AI assistance">
        <ExplainPanel key={finding.finding_id} finding={finding} />
      </Section>

      {isAdmin && finding.status !== "resolved" && (
        <Section title="Suppression">
          <SuppressControl finding={finding} onChange={onChange} />
        </Section>
      )}
    </div>
  );
}
