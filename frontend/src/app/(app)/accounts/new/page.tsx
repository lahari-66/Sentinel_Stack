"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Card, ErrorBox, Field, PageHeader, cx, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import type { CreateAccountResponse } from "@/lib/types";

const REGIONS = ["us-east-1", "us-east-2", "us-west-2", "ap-south-1", "eu-west-1", "eu-central-1", "ap-southeast-1"];

function Step({ n, title, active, done, children }: { n: number; title: string; active: boolean; done: boolean; children: ReactNode }) {
  return (
    <Card className={cx("p-5", !active && !done && "opacity-60")}>
      <div className="flex items-center gap-3">
        <span
          className={cx(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            done ? "bg-emerald-600 text-white" : active ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600",
          )}
        >
          {done ? "✓" : n}
        </span>
        <h2 className="font-medium text-slate-900">{title}</h2>
      </div>
      {(active || done) && <div className="mt-4 pl-10">{children}</div>}
    </Card>
  );
}

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [accountId, setAccountId] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [created, setCreated] = useState<CreateAccountResponse | null>(null);
  const [roleArn, setRoleArn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // "Finish setup" on a pending account jumps straight to pasting the role ARN.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existing = params.get("account");
    if (existing) {
      setAccountId(existing);
      setRegion(params.get("region") ?? "us-east-1");
      setRoleArn(`arn:aws:iam::${existing}:role/SentinelStackScannerRole`);
      setStep(3);
    }
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const accountValid = /^\d{12}$/.test(accountId);
  const arnValid = new RegExp(`^arn:aws:iam::${accountId}:role/[\\w+=,.@/-]+$`).test(roleArn.trim());

  return (
    <>
      <PageHeader title="Connect an AWS account" description="SentinelStack only gets read-only access (AWS SecurityAudit policy) and can never change anything." />
      <div className="max-w-3xl space-y-4">
        <Step n={1} title="Enter the account" active={step === 1} done={step > 1}>
          {step === 1 ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const res = await api.createAccount(accountId, region);
                  setCreated(res);
                  setRoleArn(`arn:aws:iam::${accountId}:role/SentinelStackScannerRole`);
                  setStep(2);
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="AWS account ID" hint="12 digits, shown in the top-right menu of the AWS console.">
                  <input
                    className={inputClass}
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    inputMode="numeric"
                    placeholder="123456789012"
                    autoFocus
                  />
                </Field>
                <Field label="Region to scan">
                  <select className={inputClass} value={region} onChange={(e) => setRegion(e.target.value)}>
                    {REGIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Button type="submit" loading={busy} disabled={!accountValid}>
                Continue
              </Button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">
              <span className="font-mono">{accountId}</span> · {region}
            </p>
          )}
        </Step>

        <Step n={2} title="Create the read-only role in that account" active={step === 2} done={step > 2}>
          {created ? (
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Sign in to account <span className="font-mono">{accountId}</span>, open the link below, tick
                “I acknowledge that AWS CloudFormation might create IAM resources”, and click <b>Create stack</b>.
              </p>
              <a
                href={created.quick_create_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-md bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700"
              >
                Open CloudFormation quick-create ↗
              </a>
              <p className="text-xs text-slate-500">
                The template creates one role, <span className="font-mono">SentinelStackScannerRole</span>, that only
                SentinelStack can assume, and only with this External ID:{" "}
                <span className="rounded bg-slate-100 px-1 font-mono">{created.external_id}</span>
              </p>
              {step === 2 && (
                <Button variant="secondary" onClick={() => setStep(3)}>
                  The stack is created
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Role stack deployed earlier.</p>
          )}
        </Step>

        <Step n={3} title="Paste the role ARN and verify" active={step === 3} done={connected}>
          {connected ? (
            <div className="space-y-3 text-sm">
              <p className="text-emerald-700">Connected. SentinelStack assumed the role successfully and will scan every 12 hours.</p>
              <div className="flex gap-2">
                <Link href="/accounts/" className="rounded-md bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700">
                  Go to accounts
                </Link>
                <Link href={`/scans/?account=${accountId}`} className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                  Run first scan
                </Link>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api.verifyAccount(accountId, roleArn.trim());
                  setConnected(true);
                });
              }}
            >
              <Field label="Role ARN" hint="From the stack's Outputs tab (RoleArn).">
                <input className={cx(inputClass, "font-mono")} value={roleArn} onChange={(e) => setRoleArn(e.target.value)} />
              </Field>
              <Button type="submit" loading={busy} disabled={!arnValid}>
                {busy ? "Verifying…" : "Verify connection"}
              </Button>
            </form>
          )}
        </Step>

        {error && <ErrorBox message={error} />}
      </div>
    </>
  );
}
