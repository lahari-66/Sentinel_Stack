# SentinelStack web app

Next.js (App Router) + Tailwind + Recharts, exported as static files and served from S3 behind CloudFront.
Owner: Track C.

## Run

```bash
cp .env.example .env.local   # empty values = demo mode on mock data
npm install
npm run dev                  # http://localhost:3000
```

| Script | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static export to `out/` (what gets uploaded to S3) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |

## Modes

| `NEXT_PUBLIC_*` set | Sign-in | Data |
|---|---|---|
| nothing | local demo admin | `src/lib/mock.ts` |
| Cognito values only | Cognito hosted UI | mock |
| Cognito + `API_URL` | Cognito hosted UI | live API |

`NEXT_PUBLIC_USE_MOCKS=true` forces mock data even with an API URL.

## Layout

```
src/app/login, auth/callback     sign-in (Cognito authorization code + PKCE)
src/app/(app)/accounts           account cards; accounts/new = onboarding wizard
src/app/(app)/findings           filters, table, detail drawer with Explain + suppress
src/app/(app)/scans              score trend + scan history, Scan now
src/app/(app)/audit, settings
src/lib/api.ts                   the only place that calls the API
src/lib/types.ts                 API shapes (follow docs/openapi.yaml once it lands)
src/lib/mock.ts                  demo-mode backend
src/lib/auth.ts                  Cognito PKCE flow, token storage and refresh
```

Rules for this folder:

- All API calls go through `src/lib/api.ts`; pages never call `fetch` directly.
- Strings from customer AWS accounts (resource names, tags, evidence, AI output) are rendered as text only —
  never `dangerouslySetInnerHTML`.
- Every data view handles loading, empty and error states.

## Deploy

```powershell
copy .env.production.example .env.production.local   # fill in Cognito + CloudFront values
.\deploy\deploy.ps1 -Bucket <web bucket> -DistributionId <distribution id>
```

(`deploy/deploy.sh` does the same on macOS/Linux.) `deploy/cloudfront-index-rewrite.js` is the CloudFront
Function that serves `/path/index.html` for `/path/`.

AWS setup for hosting and sign-in: [docs/setup/week1-track-c-aws-steps.md](../docs/setup/week1-track-c-aws-steps.md).
