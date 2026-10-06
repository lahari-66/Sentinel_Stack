// Typed client for the SentinelStack HTTP API (API Gateway → Lambda/FastAPI).
// Every call sends the Cognito ID token as a Bearer token. In demo mode the same functions are
// served by src/lib/mock.ts, so pages never need to know which one they are talking to.

import { getIdToken, login } from "./auth";
import { config, mockMode } from "./config";
import { mockApi, MockError } from "./mock";
import type {
  Account,
  AuditEntry,
  CreateAccountResponse,
  Explanation,
  Finding,
  FindingFilters,
  Me,
  Page,
  Rule,
  Scan,
  Settings,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | null | undefined>;

async function request<T>(method: string, path: string, opts: { body?: unknown; query?: Query } = {}): Promise<T> {
  const token = await getIdToken();
  if (!token) {
    await login(window.location.pathname);
    throw new ApiError(401, "Signed out");
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const url = `${config.apiUrl}${path}${qs.size ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the SentinelStack API. Check your connection and the API URL / CORS settings.");
  }

  if (res.status === 401) {
    await login(window.location.pathname);
    throw new ApiError(401, "Session expired");
  }
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(data) ?? `Request failed (${res.status})`);
  return data as T;
}

/** Accepts both the shared error model {error:{code,message}} and FastAPI's default {detail}. */
function errorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { error?: { message?: string }; detail?: unknown; message?: string };
  if (d.error?.message) return d.error.message;
  if (typeof d.detail === "string") return d.detail;
  if (Array.isArray(d.detail)) return d.detail.map((x: { msg?: string }) => x.msg).filter(Boolean).join("; ");
  return d.message ?? null;
}

const enc = encodeURIComponent;

const http = {
  me: () => request<Me>("GET", "/me"),

  listAccounts: () => request<Account[]>("GET", "/accounts"),
  createAccount: (accountId: string, region: string) =>
    request<CreateAccountResponse>("POST", "/accounts", { body: { account_id: accountId, region } }),
  verifyAccount: (accountId: string, roleArn: string) =>
    request<Account>("POST", `/accounts/${enc(accountId)}/verify`, { body: { role_arn: roleArn } }),
  deleteAccount: (accountId: string) => request<void>("DELETE", `/accounts/${enc(accountId)}`),

  listScans: (accountId: string) => request<Page<Scan>>("GET", `/accounts/${enc(accountId)}/scans`),
  startScan: (accountId: string) => request<Scan>("POST", `/accounts/${enc(accountId)}/scans`),
  getScan: (scanId: string) => request<Scan>("GET", `/scans/${enc(scanId)}`),

  listFindings: (filters: FindingFilters, cursor?: string | null, limit = 10) =>
    request<Page<Finding>>("GET", "/findings", { query: { ...filters, cursor, limit } }),
  getFinding: (id: string) => request<Finding>("GET", `/findings/${enc(id)}`),
  suppress: (id: string, reason: string) => request<Finding>("POST", `/findings/${enc(id)}/suppress`, { body: { reason } }),
  unsuppress: (id: string) => request<Finding>("POST", `/findings/${enc(id)}/unsuppress`),
  explain: (id: string) => request<Explanation>("POST", `/findings/${enc(id)}/explain`),

  listRules: () => request<Rule[]>("GET", "/rules"),
  listAudit: (cursor?: string | null) => request<Page<AuditEntry>>("GET", "/audit", { query: { cursor } }),
  getSettings: () => request<Settings>("GET", "/settings"),
  putSettings: (settings: Settings) => request<Settings>("PUT", "/settings", { body: settings }),
};

// Mock errors are surfaced as ApiError so pages handle both paths the same way.
function wrapMocks<T extends Record<string, (...args: never[]) => Promise<unknown>>>(impl: T): T {
  const out: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(impl)) {
    out[name] = (...args: never[]) =>
      fn(...args).catch((e: unknown) => {
        throw e instanceof MockError ? new ApiError(e.status, e.message) : e;
      });
  }
  return out as T;
}

export const api: typeof http = mockMode ? wrapMocks(mockApi as typeof http) : http;

/** GET /health is unauthenticated; used by the settings page to show connectivity. */
export async function health(): Promise<boolean> {
  if (mockMode) return true;
  try {
    const res = await fetch(`${config.apiUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
