# SentinelStack — Requirements

Owner: Track C · Reviewers: Tracks A and B · Status: draft for Week 1 review

## 1. Problem

Small teams run AWS accounts without a security engineer. Common misconfigurations — public buckets,
open SSH, users without MFA, admin Lambdas — go unnoticed until they are exploited. SentinelStack scans an
account through a read-only role, scores its posture, and explains how to fix each problem.

## 2. Users and roles

| Role | Can |
|---|---|
| **admin** | Everything a viewer can, plus connect/disconnect accounts, start scans, suppress/unsuppress findings, change settings |
| **viewer** | See accounts, scans, findings, scores, audit log; ask for an AI explanation |

Every user belongs to exactly one organisation (`custom:org_id` on the Cognito user). An organisation never
sees another organisation's data.

## 3. Functional requirements (MVP — scope frozen)

| # | Requirement | Owner |
|---|---|---|
| FR-1 | Sign-up / sign-in with Cognito hosted UI; groups `viewer` and `admin`; org isolation enforced in the API | A + B + C |
| FR-2 | Onboard an AWS account: user enters account ID → gets a CloudFormation quick-create link that creates `SentinelStackScannerRole` (SecurityAudit, External ID condition) → pastes role ARN → **Verify** performs a test AssumeRole | A + B + C |
| FR-3 | 20 posture rules across S3, IAM, EC2, EBS, CloudTrail, KMS, Lambda; each with a positive and a negative test | A |
| FR-4 | Scan engine on Step Functions with parallel rule groups; on demand and every 12 h (6/12/24 configurable) | A |
| FR-5 | Findings with deterministic keys; statuses open / resolved / suppressed; evidence; first/last seen | A + B + C |
| FR-6 | Posture score 0–100 = 100 − (20×CRITICAL + 10×HIGH + 4×MEDIUM + 1×LOW), floor 0, suppressed excluded; trend chart; scan history; diff vs previous scan | A + C |
| FR-7 | Email alert only when a scan finds **new** findings; no email on an unchanged rescan | B |
| FR-8 | "Explain & draft fix" with Bedrock: explanation, impact, CLI fix, CloudFormation fix — text proposal only, clearly labelled as an AI proposal, cached per finding | B + C |
| FR-9 | Known-insecure and known-secure test stacks; CI proves full detection and zero false positives | C + B |
| FR-10 | CloudWatch dashboard + 5 tested alarms; CloudTrail and KMS on our own account | B + A |
| FR-11 | CI/CD with GitHub Actions + CDK: dev → manual approval → prod | B |
| FR-12 | Public HTTPS URL, README, architecture diagram, demo video, published self-scan score | A + C |

### Screens (Track C)

| Screen | Route | Requirement |
|---|---|---|
| Login | `/login/` → Cognito hosted UI → `/auth/callback/` | FR-1 |
| Accounts | `/accounts/` — cards with status, last score, last scan, Scan now, Disconnect | FR-2, FR-6 |
| Onboarding wizard | `/accounts/new/` — account ID → quick-create link → role ARN → Verify | FR-2 |
| Findings | `/findings/` — severity chips, service/status/rule filters, resource search, cursor pagination, detail drawer | FR-5 |
| Finding detail | drawer — evidence, rule description, first/last seen, Explain panel, suppress | FR-5, FR-8 |
| Scans | `/scans/` — score trend, history with counts and new/resolved, Scan now | FR-4, FR-6 |
| Audit log | `/audit/` | FR-5 (suppress), FR-2 |
| Settings | `/settings/` — org name, alert recipients, scan interval | FR-4, FR-7 |

## 4. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Customer footprint is one read-only role; trust is limited to our scanner Lambda role **and** the External ID (`StringEquals sts:ExternalId`); session ≤ 1 h. External IDs are KMS-encrypted at rest and never logged. |
| Security | Resource names, tags and evidence from customer accounts are **untrusted**: rendered as text in the UI (never HTML) and treated as data in Bedrock prompts (prompt-injection test in Week 3). |
| Security | JWT authorizer on every route except `/health`; org scoping from token claims, never from request parameters. |
| Performance | A full scan of the target stack completes in under 3 minutes. |
| Reliability | One failing rule does not fail the scan (recorded in `rule_errors`); failures go to an SQS DLQ and alarm. |
| Cost | Total AWS spend ≤ $25 of the $100 credit; Budgets alerts at $10 / $25 / $50 / $80. |
| Usability | Works on phone and desktop widths; every list has loading, empty and error states. |
| Operability | Structured JSON logs carrying `scan_id`, `account_id`, `rule_id`. |

## 5. Out of scope (roadmap)

CloudTrail log ingestion, anomaly detection, executing remediations, Slack alerts, multi-region scanning,
PDF reports.

## 6. Definition of Done

See section 4 of the build plan: public HTTPS URL with a demo org; all 12 capabilities on prod; 20/20
detection and 0 false positives in CI; new-only alerts; explain passes the injection test; dashboard + 5
tested alarms; own account scanned and documented; README, diagram, runbook, API docs, demo video, resume
bullets, interview prep; spend ≤ $25; release `v1.0.0`.
