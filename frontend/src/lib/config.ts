// Build-time configuration. NEXT_PUBLIC_* values are inlined into the static bundle, so they must be
// public identifiers only (URLs, client IDs) — never secrets.

export const config = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
  cognitoDomain: (process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "").replace(/\/+$/, ""),
  cognitoClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "",
  redirectUri: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI ?? "",
  logoutUri: process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI ?? "",
  forceMocks: process.env.NEXT_PUBLIC_USE_MOCKS === "true",
};

export const authConfigured = Boolean(
  config.cognitoDomain && config.cognitoClientId && config.redirectUri,
);

/** Demo mode: no API configured (or mocks forced) — every call is served from src/lib/mock.ts. */
export const mockMode = config.forceMocks || !config.apiUrl;
