# Frontend ↔ API contract (Track C → Track B)

The web app is built against these shapes now, on mock data (`frontend/src/lib/mock.ts`), so neither track
waits on the other. Once `docs/openapi.yaml` lands, it wins — and `frontend/src/lib/types.ts` is updated to
match. Please raise anything you disagree with at the Mon/Wed/Fri sync.

## Decisions the frontend already relies on

| # | Topic | What the frontend does | Needs from B / A |
|---|---|---|---|
| 1 | Auth token | Sends the Cognito **ID token** as `Authorization: Bearer <token>` | ID token carries `custom:org_id` and `cognito:groups`; API Gateway JWT authorizer audience = app client ID |
| 2 | Sign-in | Authorization-code grant with PKCE, public app client (no secret) | Cognito app client: no secret; scopes `openid email profile`; callback `/auth/callback/`; sign-out `/login/` (trailing slashes matter) |
| 3 | CORS | Browser calls the API cross-origin | HTTP API CORS: allow origins = CloudFront domain (+ `http://localhost:3000` in dev), headers `authorization, content-type`, methods `GET, POST, PUT, DELETE` |
| 4 | Errors | Reads `{"error": {"code", "message"}}` or FastAPI `{"detail"}` and shows the message | Use the shared error model with human-readable messages |
| 5 | 401 | Redirects to sign-in | Return 401 (not 403) for missing/expired tokens; 403 for viewer hitting admin routes |
| 6 | Pagination | `?cursor=<opaque>&limit=<n>` → `{ "items": [...], "next_cursor": "..." \| null }` | Same envelope for `/findings`, `/audit`, `/accounts/{id}/scans` |
| 7 | IDs in paths | `encodeURIComponent` on finding IDs (`FIND#S3-001#ab12…`) and scan IDs | Accept URL-encoded `#`, or switch to an ID without `#` (e.g. `S3-001.ab12…`) — **your call** |

## Endpoints and shapes

| Method & path | Request | Response |
|---|---|---|
| `GET /health` | — (no auth) | `200` |
| `GET /me` | — | `Me { sub, email, org_id, role }` |
| `GET /accounts` | — | `Account[]` |
| `POST /accounts` | `{ account_id, region }` | `{ account, external_id, quick_create_url }` |
| `POST /accounts/{id}/verify` | `{ role_arn }` | `Account` (status `connected`), or 4xx with a message on AssumeRole failure |
| `DELETE /accounts/{id}` | — | `204` |
| `POST /accounts/{id}/scans` | — | `Scan` (status `running`) |
| `GET /accounts/{id}/scans` | — | `Page<Scan>`, newest first |
| `GET /scans/{scanId}` | — | `Scan` |
| `GET /findings` | `account_id, severity, service, status, rule_id, q, cursor, limit` | `Page<Finding>`, CRITICAL first |
| `GET /findings/{id}` | — | `Finding` |
| `POST /findings/{id}/suppress` | `{ reason }` | `Finding` |
| `POST /findings/{id}/unsuppress` | — | `Finding` |
| `POST /findings/{id}/explain` | — | `Explanation { explanation, impact, cli_fix, cloudformation_fix, model, generated_at, cached }` |
| `GET /rules` | — | `Rule[] { rule_id, title, severity, service, description }` |
| `GET /audit` | `cursor` | `Page<AuditEntry { at, user, action, target, details }>` |
| `GET /settings` · `PUT /settings` | `Settings { name, alert_emails[], scan_interval_hours }` | `Settings` |

Fields not in the plan's data model that the UI uses — please confirm or reject:

- `Account.last_scan_at`, `Account.created_at`
- `Scan.scan_id`, `Scan.account_id`, `Scan.trigger` (`manual` / `schedule`)
- `Finding.finding_id`, `Finding.account_id`, `Finding.title` (copied from the rule so the list needs no join)
- `q` filter on `/findings` (substring of `resource_arn`) — plan says "resource search"

The full TypeScript definitions are in [`frontend/src/lib/types.ts`](../frontend/src/lib/types.ts).
