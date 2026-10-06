# Runbook

Everything the team creates in AWS, so it can be torn down cleanly at the end (Day-1 checklist item 10).
Alarm-by-alarm "what to do" sections are added by Track B in Week 4.

Step-by-step console instructions: [setup/aws-console-guide.md](setup/aws-console-guide.md).

## Resource inventory

Add a row the moment you create something. Remove it only after it has been deleted.

| Created (date) | By | Region | Resource | Name / ID | How it was created | Teardown |
|---|---|---|---|---|---|---|
| | | global | Root MFA | — | Console | keep |
| | | global | IAM users | dev-a, dev-b, dev-c | Console | delete users + access keys |
| | | global | Budget | sentinel-budget ($10/$25/$50/$80) | Console | delete budget |
| | | platform | CloudTrail trail | sentinel-org-trail + S3 bucket + KMS key | Console | delete trail, empty + delete bucket, schedule key deletion |
| | | platform | Bedrock model access | | Console | — |
| | | platform | SES identities | 3 team emails | Console | delete identities |
| | | global | IAM OIDC provider + role | token.actions.githubusercontent.com, sentinel-github-deploy | Console | delete role, provider |
| | | both | CDK bootstrap | CDKToolkit stack | `cdk bootstrap` | delete CDKToolkit stack + its bucket |
| | | target | Insecure test stack | sentinel-target-insecure | CloudFormation | delete stack (KMS key: 7-day wait) |
| | | target | Account-level S3 BPA (policy settings) changed | — | Console | **turn back on** |
| | | platform | Cognito user pool (temporary, until core-dev) | | Console | delete pool + domain |
| | | platform | Web bucket + CloudFront + function + OAC | | Console | disable + delete distribution, delete function/OAC, empty + delete bucket |

## Weekly cost check (every Monday before work)

Billing → **Cost Explorer** → last 30 days, group by Service. Record the total here:

| Week | Date | Total spend | Notes |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
