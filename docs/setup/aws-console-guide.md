# AWS console guide — Day 1

Step-by-step console instructions for the Day-1 checklist (plan section 6), done by all three together.
Track C's own Week 1 AWS work is in [week1-track-c-aws-steps.md](week1-track-c-aws-steps.md). Do the steps
in order. Write every resource you create into [`docs/runbook.md`](../runbook.md) so it can be torn down
cleanly at the end.

> **Credentials rule.** Your IAM access keys live only in `~/.aws/credentials` on your own laptop. Never
> paste them into chat, Slack, a commit, a `.env` file, or a screenshot. If a key ever leaks, deactivate it
> in IAM immediately and create a new one.

Values used below — agree on them at the Day-1 meeting and fill them in here:

| Name | Value |
|---|---|
| Platform region | `ap-south-1` (Mumbai) |
| Target region | `us-east-1` (N. Virginia) |
| AWS account ID | `____________` |
| Your IAM user | `dev-c` (Track C) |

---

## Part 1 — Day-1 checklist (all three together, in this order)

### 1.1 Root account (the person who owns the root login)

1. Sign in as root → top-right account menu → **Security credentials**.
2. **Multi-factor authentication (MFA)** → **Assign MFA device** → Authenticator app → scan the QR code
   → enter two consecutive codes → **Add MFA**.
3. On the same page, under **Access keys**: there must be **none**. If any exist → **Actions → Delete**.
4. Make sure the root password is long and unique. Sign out of root; from now on nobody uses it.

### 1.2 IAM users dev-a, dev-b, dev-c

1. Console → **IAM → Users → Create user**.
2. User name `dev-a` → tick **Provide user access to the AWS Management Console** → **I want to create an
   IAM user** → custom password → untick "must create a new password" only if you'll hand it over in person.
3. **Permissions options → Attach policies directly** → tick **AdministratorAccess** → **Next → Create user**.
4. Repeat for `dev-b` and `dev-c`.
5. Each person signs in as their own user (sign-in URL is on the IAM dashboard) → top-right menu →
   **Security credentials → Assign MFA device** → authenticator app.
6. Still in **Security credentials → Access keys → Create access key** → use case **Command Line Interface
   (CLI)** → tick the confirmation → **Create**. Copy the key ID and secret **straight into the CLI** (step
   1.8); don't save them anywhere else. Download the CSV only if you'll delete it right after.

### 1.3 Budgets ($10 / $25 / $50 / $80)

1. Console → **Billing and Cost Management → Budgets → Create budget**.
2. Choose **Customize (advanced) → Cost budget → Next** (the templates only allow one alert).
3. Name `sentinel-budget`, period **Monthly**, **Fixed**, amount **80**.
4. **Add alert threshold** four times, each **Actual** cost, **Absolute value**: `10`, `25`, `50`, `80`.
   Email recipients for each: all three team emails.
5. **Next → Create budget.** Check that each person received the "you've been added" email.

### 1.4 CloudTrail multi-region trail

1. Switch to the **platform region** (top-right region picker).
2. **CloudTrail → Trails → Create trail**.
3. Name `sentinel-org-trail`. Storage: **Create new S3 bucket** (accept the name).
4. **Log file SSE-KMS encryption**: leave enabled → **New** KMS key, alias `sentinel-cloudtrail`.
5. **Log file validation: Enabled** (important — otherwise rule CT-002 fires on your own account).
6. Leave CloudWatch Logs off (costs money). **Next**.
7. Event type: **Management events** only, Read + Write. **Next → Create trail**.
8. Open the trail and confirm **Multi-region trail: Yes** (it is by default for console-created trails).

### 1.5 Regions and Bedrock model access

1. Confirm platform region and target region (table above).
2. Switch to the **platform region** → **Amazon Bedrock → Model access** (left menu, bottom).
3. **Modify model access** / **Enable specific models** → select one small, low-cost text model the team
   agrees on (e.g. Amazon Nova Lite) → **Next → Submit**. Some third-party models ask for a short use-case
   form — fill it in honestly ("security posture tool, student project").
4. It can take minutes to hours. The status must show **Access granted** before Week 3.
   *If the model is not offered in the platform region, note which region has it — Track B needs that.*

### 1.6 SES — verify the three team emails

1. Platform region → **Amazon SES → Identities → Create identity**.
2. **Email address** → enter one team email → **Create identity**.
3. That person clicks the verification link in their inbox. Repeat for all three.
4. Status must be **Verified**. (SES sandbox only sends to verified addresses — that is fine for the MVP.)

### 1.7 GitHub OIDC + deploy role (Track B leads; everyone watches)

1. **IAM → Identity providers → Add provider → OpenID Connect**.
   Provider URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com` → **Add provider**.
2. **IAM → Roles → Create role → Web identity** → provider `token.actions.githubusercontent.com`,
   audience `sts.amazonaws.com`, GitHub organization `lahari-66`, repository `Sentinel_Stack`, branch `main`
   → attach **AdministratorAccess** for the build (tightened in Week 4) → name `sentinel-github-deploy`.
3. Open the role → **Trust relationships → Edit** and confirm the condition reads
   `"token.actions.githubusercontent.com:sub": "repo:lahari-66/Sentinel_Stack:ref:refs/heads/main"`.
4. GitHub repo → **Settings → Branches → Add branch ruleset / protection rule** for `main`: require a pull
   request, 1 approval, and status checks once CI exists.

### 1.8 Your laptop

Install: Git, Node 20+, Python 3.12, AWS CLI v2, AWS CDK CLI (`npm i -g aws-cdk`), Docker Desktop,
cfn-lint (`pip install cfn-lint`), VS Code. Then:

```bash
aws configure --profile sentinel
#   AWS Access Key ID:     <your dev-c key id>
#   AWS Secret Access Key: <your dev-c secret>
#   Default region name:   ap-south-1
#   Default output format: json
aws sts get-caller-identity --profile sentinel
```

**Done when** the output shows `arn:aws:iam::<account>:user/dev-c`.

### 1.9 CDK bootstrap (Track A runs it; once per region)

```bash
cdk bootstrap aws://<ACCOUNT_ID>/ap-south-1 --profile sentinel
cdk bootstrap aws://<ACCOUNT_ID>/us-east-1  --profile sentinel
```

### 1.10 Runbook

Add every item you created in Part 1 to the table in `docs/runbook.md`.

---

---

Next for Track C: [Week 1 AWS steps](week1-track-c-aws-steps.md) — target stack, Cognito, S3 + CloudFront.
