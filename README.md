# SentinelStack

SentinelStack connects to AWS accounts through a read-only cross-account role, scans them for 20 common
security misconfigurations, scores them 0–100, shows findings on a dashboard, emails alerts for new
problems, and uses AI to explain how to fix each one.

> Status: **Week 1 — foundation.** This README grows into the full project README in Week 4
> (demo GIF, architecture diagram, rule catalogue, CI detection numbers, own-account score, cost table).

## Team 8

| Track | Owns |
|---|---|
| A — Scanner & IAM | AWS account hardening, CDK infrastructure, onboarding template, cross-account AssumeRole, the 20 rules, Step Functions scan engine, scoring, KMS |
| B — Backend API, Alerts & AI | FastAPI on Lambda, DynamoDB repositories, SES alerts, Bedrock "Explain & draft fix", CI/CD, monitoring |
| C — Frontend, Test Stacks & Docs | Next.js web app, insecure/secure target stacks, self-scan, README, diagrams, runbook, demo video |

## Repository layout

```
docs/        requirements, architecture, data model, OpenAPI, rules, runbook, ADRs
infra/       AWS CDK app (Python): core, api, scanner, web, observability stacks      — Track A
backend/     FastAPI app, scanner Lambdas, rules, scoring, explain, tests             — Tracks A + B
frontend/    Next.js static web app                                                   — Track C
tools/       onboarding.yaml, target-insecure.yaml + expected_findings.json, target-secure.yaml
.github/     CI (ci.yml on PR) and deploy (deploy.yml on main) workflows              — Track B
```

## Frontend quick start

```bash
cd frontend
cp .env.example .env.local   # leave values empty to run on mock data
npm install
npm run dev                  # http://localhost:3000
npm run build                # static export into frontend/out/
```

With no `NEXT_PUBLIC_API_URL` / Cognito values set, the app runs in **demo mode** on mock data that
follows `docs/data-model.md`, so the UI can be built before the API lands (contract first).

## Docs

- [Requirements](docs/requirements.md)
- [Data model](docs/data-model.md)
- [Architecture](docs/architecture.md)
- [Runbook](docs/runbook.md)

## Not in the 4-week scope (roadmap)

CloudTrail log ingestion, anomaly detection, executing remediations, Slack alerts, multi-region scanning,
PDF reports.
