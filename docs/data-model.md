# Data model — DynamoDB single table `sentinelstack`

Owner: Track C (document) · Source of truth for shapes: Track A (engine) and Track B (API)

On-demand capacity, KMS-encrypted (customer-managed key), point-in-time recovery on.

## Entities

| Entity | PK | SK | Key attributes |
|---|---|---|---|
| Org | `ORG#<orgId>` | `META` | `name`, `alert_emails[]`, `scan_interval_hours` (6 / 12 / 24) |
| User | `ORG#<orgId>` | `USER#<cognitoSub>` | `email`, `role` (`viewer` / `admin`) |
| Account | `ORG#<orgId>` | `ACCT#<awsAccountId>` | `role_arn`, `external_id_enc`, `region`, `status`, `last_scan_id`, `last_score` |
| Scan | `ACCT#<awsAccountId>` | `SCAN#<isoTimestamp>` | `status`, `started_at`, `finished_at`, `score`, `counts{critical,high,medium,low}`, `new`, `resolved`, `snapshot_key`, `rule_errors` |
| Finding | `ACCT#<awsAccountId>` | `FIND#<ruleId>#<sha1(resourceArn)>` | `rule_id`, `service`, `severity`, `resource_arn`, `evidence` (JSON), `status`, `first_seen`, `last_seen`, `resolved_at`, `suppressed{by,reason,at}`, `explanation_cache` |
| Audit | `ORG#<orgId>` | `AUDIT#<isoTimestamp>#<uuid>` | `user`, `action`, `target`, `details` |

### Why these keys

- **Org-scoped partition** (`ORG#…`) keeps an org's metadata, users, accounts and audit trail together, so
  one `Query` with `begins_with(SK, "ACCT#")` lists accounts and org isolation is a key condition, not a filter.
- **Account-scoped partition** (`ACCT#…`) for scans and findings: scan history is
  `begins_with(SK, "SCAN#")` with `ScanIndexForward=false` (newest first, because ISO timestamps sort).
- **Deterministic finding key** `FIND#<ruleId>#<sha1(resourceArn)>`: the same problem on the same resource
  always maps to the same item, so a rescan updates `last_seen` instead of creating a duplicate, and the
  aggregate step can diff "new" vs "resolved" by key.

## Global secondary indexes

| Index | PK | SK | Answers |
|---|---|---|---|
| GSI1 | `ACCT#<id>#STATUS#<status>` | `SEVERITY#<sev>#<ruleId>` | Findings queue: open findings for an account, ordered by severity |
| GSI2 | `ORG#<id>` | `ACCT#…` | Already covered by the base table (kept for symmetry in the plan; Track A may drop it) |
| GSI3 | `RULE#<ruleId>` | `ACCT#<id>` | Which rule fires most across accounts |

> Severity sort order: store `SEVERITY#1-CRITICAL`, `#2-HIGH`, `#3-MEDIUM`, `#4-LOW` (or similar) so
> lexical order equals severity order — **open question for Track A**.

## Value sets

| Field | Values |
|---|---|
| `Account.status` | `pending` (created, not verified) · `connected` (AssumeRole works) · `disconnected` (AssumeRole failed) |
| `Scan.status` | `running` · `succeeded` · `failed` |
| `Finding.status` | `open` · `resolved` (not seen in the latest scan) · `suppressed` (by an admin, with reason) |
| `Finding.severity` | `CRITICAL` · `HIGH` · `MEDIUM` · `LOW` |
| `Finding.service` | `s3` · `iam` · `ec2` · `ebs` · `cloudtrail` · `kms` · `lambda` |
| `User.role` | `viewer` · `admin` |

## Score

`score = max(0, 100 − (20×CRITICAL + 10×HIGH + 4×MEDIUM + 1×LOW))` over **open** findings; suppressed and
resolved findings are excluded. Stored on each Scan and copied to `Account.last_score`.

## Snapshots (S3)

One JSON file per scan at `snapshots/<accountId>/<scanId>.json` (proposal), KMS-encrypted, 90-day lifecycle.
`Scan.snapshot_key` points to it.

## Things that are never stored or logged in clear text

External IDs (`external_id_enc` is KMS-encrypted), AWS credentials from AssumeRole, and evidence fields that
could contain secrets.

## API representation

The API returns items without `PK`/`SK`; see `frontend/src/lib/types.ts` for the shapes the web app expects
and [frontend-api-contract.md](frontend-api-contract.md) for the open questions with Track B.
