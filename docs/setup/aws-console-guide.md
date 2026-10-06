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
| Your IAM user | `dev-c` (Track C) — see 1.2 |

---

## Part 1 — Day-1 checklist (all three together, in this order)

### 1.1 Root account (Track A, who holds the root login)

The plan: *"Root account: strong password, MFA, no access keys"* and *"Never share root."* Root is used
only for 1.1 and 1.2, then never again.

1. Sign in as root → top-right account menu → **Security credentials**.
2. **Multi-factor authentication (MFA)** → **Assign MFA device** → Authenticator app → scan the QR code
   → enter two consecutive codes → **Add MFA**.
3. On the same page, under **Access keys**: there must be **none**. If any exist → **Actions → Delete**.
4. Make sure the root password is long and unique.
5. **Let the IAM users see billing** (only root can do this — without it, `dev-a/b/c` get *Access denied* on
   Budgets and Cost Explorer even with AdministratorAccess):
   top-right account menu → **Account** → scroll to **IAM user and role access to Billing information** →
   **Edit** → tick **Activate IAM Access** → **Update**.
6. **Stay signed in as root** and continue with 1.2 — someone has to create the first IAM users.

### 1.2 The three IAM logins: dev-a, dev-b, dev-c

The plan: *"IAM users dev-a, dev-b, dev-c, MFA on all three, AdministratorAccess for the build"* and
*"keys only on your own laptop."* One login per person, never shared:

| IAM user | Used by | Profile on their laptop |
|---|---|---|
| `dev-a` | Track A — Scanner & IAM | `sentinel` |
| `dev-b` | Track B — Backend, Alerts & AI | `sentinel` |
| `dev-c` | Track C — Frontend, Test Stacks & Docs | `sentinel` |

(The plan names the users but doesn't map them to tracks; this mapping is the team convention.)

**If the three users already exist**, don't recreate them — check them instead:

1. **IAM → Users.** Exactly `dev-a`, `dev-b`, `dev-c`. The only other user allowed is the deny-all test
   user `sentinel-target-console-user-us-east-1`, which appears once Track C deploys the target stack.
2. For each user, the list columns (use the ⚙ icon to show them) must read:
   **MFA** = *Virtual* (not empty) · **Console last sign-in** = a date once they've logged in ·
   **Active key age** = only one key, created by that person.
3. Open each user → **Permissions** tab → **AdministratorAccess** is attached.
4. Anything missing → fix it with the matching step below.

**To create them** (root, continuing from 1.1):

1. **IAM → Users → Create user**.
2. User name `dev-a` → tick **Provide user access to the AWS Management Console** → if asked, choose
   **I want to create an IAM user** → **Custom password** → a temporary password → keep
   **Users must create a new password at next sign-in** ticked → **Next**.
3. **Permissions options → Attach policies directly** → tick **AdministratorAccess** → **Next → Create user**.
4. Copy the **console sign-in URL** shown on the success page (`https://<account-id>.signin.aws.amazon.com/console`).
5. Repeat for `dev-b` and `dev-c`. Give each person their user name and temporary password **in person or by
   phone** — not in the group chat.
6. **Root signs out now** and doesn't sign in again (except for billing emergencies).

**Each person, on their own laptop** (Track C does this as `dev-c`):

7. Open the sign-in URL → **IAM user** → account ID, your user name, temporary password → set a new password.
8. Top-right menu → **Security credentials** → **Assign MFA device** → name `dev-c-phone` →
   **Authenticator app** → scan → two consecutive codes → **Add MFA**. Sign out and in again to confirm MFA
   is asked.
9. **Security credentials → Access keys → Create access key** → use case **Command Line Interface (CLI)** →
   tick the confirmation → **Next → Create access key**. Keep this page open and go straight to step 1.8 to
   paste the two values into `aws configure`. Don't download the CSV, don't save them anywhere else, and
   never send them to anyone — teammates use their own keys.

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

**Done when** the output shows `arn:aws:iam::<account>:user/dev-c` — and the same command shows
`user/dev-a` and `user/dev-b` on the other two laptops (plan, Week 1 Monday: *"all three run aws sts
get-caller-identity with their own profile"*). If it shows `:root`, you configured root keys — delete
them (1.1 step 3) and use your IAM user's key.

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
