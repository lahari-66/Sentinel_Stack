// Cognito hosted-UI sign-in using the OAuth 2.0 authorization-code grant with PKCE.
// The app client is public (no client secret), so nothing secret ever ships to the browser.
//
// Tokens live in sessionStorage: they survive a page reload but not closing the tab.
// The API is called with the ID token, because it carries custom:org_id and cognito:groups,
// which the backend uses for org isolation and the viewer/admin role.

import { authConfigured, config } from "./config";
import type { Role } from "./types";

const TOKENS_KEY = "ss.tokens";
const PKCE_KEY = "ss.pkce";
const RETURN_TO_KEY = "ss.returnTo";

interface StoredTokens {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
}

export interface Session {
  email: string;
  sub: string;
  org_id: string;
  role: Role;
  demo: boolean;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLength = 32): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return new Uint8Array(digest);
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1] ?? "";
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decodeURIComponent(escape(json)));
}

function readTokens(): StoredTokens | null {
  try {
    const raw = sessionStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

function writeTokens(tokens: StoredTokens | null) {
  try {
    if (tokens) sessionStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    else sessionStorage.removeItem(TOKENS_KEY);
  } catch {
    // Storage blocked (private mode etc.) — the user simply has to sign in again.
  }
}

async function tokenRequest(body: Record<string, string>): Promise<StoredTokens> {
  const res = await fetch(`${config.cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);
  const data = await res.json();
  return {
    id_token: data.id_token,
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? body.refresh_token,
    expires_at: Date.now() + Number(data.expires_in ?? 3600) * 1000,
  };
}

const DEMO_TOKEN = "demo";

/** Starts sign-in. In demo mode (Cognito not configured) it signs in a local demo admin instead. */
export async function login(returnTo = "/accounts/"): Promise<void> {
  sessionStorage.setItem(RETURN_TO_KEY, returnTo);
  if (!authConfigured) {
    writeTokens({ id_token: DEMO_TOKEN, access_token: DEMO_TOKEN, expires_at: Date.now() + 8 * 3600_000 });
    window.location.assign(returnTo);
    return;
  }
  const verifier = randomString(64);
  const state = randomString(16);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.cognitoClientId,
    redirect_uri: config.redirectUri,
    scope: "openid email profile",
    code_challenge_method: "S256",
    code_challenge: base64UrlEncode(await sha256(verifier)),
    state,
  });
  window.location.assign(`${config.cognitoDomain}/oauth2/authorize?${params}`);
}

/** Completes sign-in on /auth/callback/. Returns the path to continue to. */
export async function handleCallback(search: string): Promise<string> {
  const params = new URLSearchParams(search);
  const error = params.get("error_description") ?? params.get("error");
  if (error) throw new Error(error);

  const pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? "null") as
    | { verifier: string; state: string }
    | null;
  sessionStorage.removeItem(PKCE_KEY);
  const code = params.get("code");
  if (!pkce || !code || params.get("state") !== pkce.state) {
    throw new Error("Sign-in response did not match this browser session. Please try again.");
  }

  writeTokens(
    await tokenRequest({
      grant_type: "authorization_code",
      client_id: config.cognitoClientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: pkce.verifier,
    }),
  );
  const returnTo = sessionStorage.getItem(RETURN_TO_KEY) ?? "/accounts/";
  sessionStorage.removeItem(RETURN_TO_KEY);
  return returnTo;
}

/** Returns a valid ID token, refreshing it if it expires within a minute; null if signed out. */
export async function getIdToken(): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;
  if (tokens.expires_at - Date.now() > 60_000) return tokens.id_token;
  if (!authConfigured || !tokens.refresh_token) {
    writeTokens(null);
    return null;
  }
  try {
    const refreshed = await tokenRequest({
      grant_type: "refresh_token",
      client_id: config.cognitoClientId,
      refresh_token: tokens.refresh_token,
    });
    writeTokens(refreshed);
    return refreshed.id_token;
  } catch {
    writeTokens(null);
    return null;
  }
}

export function getSession(): Session | null {
  const tokens = readTokens();
  if (!tokens) return null;
  if (tokens.id_token === DEMO_TOKEN) {
    return { email: "demo@sentinelstack.dev", sub: "demo-user", org_id: "demo-org", role: "admin", demo: true };
  }
  try {
    const claims = decodeJwtPayload(tokens.id_token);
    const groups = (claims["cognito:groups"] as string[] | undefined) ?? [];
    return {
      email: String(claims.email ?? ""),
      sub: String(claims.sub ?? ""),
      org_id: String(claims["custom:org_id"] ?? ""),
      role: groups.includes("admin") ? "admin" : "viewer",
      demo: false,
    };
  } catch {
    return null;
  }
}

export function logout(): void {
  writeTokens(null);
  if (authConfigured && config.logoutUri) {
    const params = new URLSearchParams({ client_id: config.cognitoClientId, logout_uri: config.logoutUri });
    window.location.assign(`${config.cognitoDomain}/logout?${params}`);
  } else {
    window.location.assign("/login/");
  }
}
