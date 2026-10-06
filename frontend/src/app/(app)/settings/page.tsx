"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useIsAdmin } from "@/components/AuthProvider";
import { Button, Card, ErrorBox, Field, PageHeader, Spinner, inputClass } from "@/components/ui";
import { api, health } from "@/lib/api";
import { config, mockMode } from "@/lib/config";
import type { Settings } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SettingsPage() {
  const isAdmin = useIsAdmin();
  const loaded = useAsync(() => api.getSettings(), []);
  const [form, setForm] = useState<Settings | null>(null);
  const [emails, setEmails] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    if (loaded.data) {
      setForm(loaded.data);
      setEmails(loaded.data.alert_emails.join("\n"));
    }
  }, [loaded.data]);

  useEffect(() => {
    void health().then(setApiHealthy);
  }, []);

  const emailList = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  const invalid = emailList.filter((e) => !EMAIL.test(e));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await api.putSettings({ ...form, alert_emails: emailList });
      setForm(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Organisation name, alert recipients and scan schedule." />
      {loaded.loading && !form && <Spinner />}
      {loaded.error && <ErrorBox message={loaded.error} onRetry={loaded.reload} />}

      <div className="grid gap-6 lg:grid-cols-3">
        {form && (
          <Card className="p-6 lg:col-span-2">
            <form onSubmit={save} className="space-y-5">
              <fieldset disabled={!isAdmin} className="space-y-5">
                <Field label="Organisation name">
                  <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
                </Field>
                <Field label="Alert recipients" hint="One email per line. Emails are sent only when a scan finds new problems. In the SES sandbox each address must be verified first.">
                  <textarea className={`${inputClass} font-mono`} rows={4} value={emails} onChange={(e) => setEmails(e.target.value)} />
                </Field>
                {invalid.length > 0 && <p className="text-sm text-red-700">Not a valid email: {invalid.join(", ")}</p>}
                <Field label="Scan interval">
                  <select
                    className={inputClass}
                    value={form.scan_interval_hours}
                    onChange={(e) => setForm({ ...form, scan_interval_hours: Number(e.target.value) as Settings["scan_interval_hours"] })}
                  >
                    <option value={6}>Every 6 hours</option>
                    <option value={12}>Every 12 hours</option>
                    <option value={24}>Every 24 hours</option>
                  </select>
                </Field>
              </fieldset>
              {isAdmin ? (
                <div className="flex items-center gap-3">
                  <Button type="submit" loading={saving} disabled={invalid.length > 0 || emailList.length === 0 || !form.name.trim()}>
                    Save settings
                  </Button>
                  {saved && <span className="text-sm text-emerald-700">Saved.</span>}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Only admins can change settings.</p>
              )}
              {error && <ErrorBox message={error} />}
            </form>
          </Card>
        )}

        <Card className="h-fit p-6 text-sm">
          <h2 className="font-medium text-slate-900">Connection</h2>
          <dl className="mt-3 space-y-2">
            <div>
              <dt className="text-xs text-slate-500">Mode</dt>
              <dd>{mockMode ? "Demo (mock data)" : "Live API"}</dd>
            </div>
            {!mockMode && (
              <div>
                <dt className="text-xs text-slate-500">API</dt>
                <dd className="break-all font-mono text-xs">{config.apiUrl}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-500">Health</dt>
              <dd>{apiHealthy === null ? "Checking…" : apiHealthy ? <span className="text-emerald-700">Healthy</span> : <span className="text-red-700">Unreachable</span>}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
