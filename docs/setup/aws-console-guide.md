# AWS console guide — Day 1 + Track C

Step-by-step console instructions for everything AWS that the frontend and test stacks need. Do the steps
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

## Part 2 — Deploy the insecure target stack (Track C, Week 1 Wednesday)

This stack is **deliberately insecure**. It lives only in the **target region**, and the dangerous parts
are neutralised (explicit Deny-all on the user and the Lambda role, empty bucket, no EC2 instances).
Cost ≈ $1.10/month, charged by the hour — delete it when you're not testing.

### 2.1 Pre-checks in the target region (`us-east-1`)

1. **S3 → Block Public Access settings for this account** (left menu). If **Block public access (bucket
   policies)** is **On** at account level, the public bucket policy will be rejected and the stack fails.
   Turn off only the two *policy* checkboxes ("…through new public bucket or access point policies" and
   "…through any public bucket or access point policies") for the duration of the test, and turn them back
   on when you delete the stack. Write this in the runbook.
2. **EC2 → Settings (left menu, under Account attributes) → Data protection and security → EBS encryption**.
   If **Always encrypt new EBS volumes** is enabled, the unencrypted volume can't be created. Either disable
   it for the test (and re-enable after) or delete the `UnencryptedVolume` resource from the template and
   move EBS-001 to `not_covered` in `expected_findings.json`.
3. **VPC → Your VPCs**: there must be a **default VPC** (the security groups go there). If missing:
   **Actions → Create default VPC**.

### 2.2 Create the stack

1. Region picker → **US East (N. Virginia)**.
2. **CloudFormation → Stacks → Create stack → With new resources (standard)**.
3. **Choose an existing template → Upload a template file** → `tools/target-insecure.yaml` → **Next**.
4. Stack name: **`sentinel-target-insecure`** (exactly — CI uses this name).
5. `ConsoleUserPassword`: generate a 24+ character random password (a password manager) and don't save it
   — nobody needs to log in as this user.
6. **Next** → Tags: add `project = sentinelstack` → **Next**.
7. Tick **I acknowledge that AWS CloudFormation might create IAM resources with custom names** → **Submit**.
8. Wait for **CREATE_COMPLETE** (2–3 minutes). If it rolls back, open the **Events** tab, find the first
   `CREATE_FAILED` and check the pre-checks in 2.1.

### 2.3 Verify ("Done when: deploys in the target region")

Open **Outputs** — you should see 9 values (bucket, user, three security groups, volume, key, function).
Spot-check two in the console:

- **EC2 → Security Groups**: `sentinel-target-all-open` has inbound *All traffic 0.0.0.0/0*.
- **S3 → the bucket → Permissions**: "Publicly accessible" badge, bucket policy with `"Principal": "*"`.

Take a screenshot of the Outputs tab for the Saturday demo.

### 2.4 Tear down (when not testing)

**CloudFormation → sentinel-target-insecure → Delete**. The KMS key waits 7 days before it is really
deleted (no further charge after that). Re-enable the account-level S3 Block Public Access and EBS default
encryption if you changed them in 2.1.

---

## Part 3 — Cognito sign-in for the web app (Week 1 Thursday)

The Cognito user pool belongs to Track A's **core** CDK stack. **If core-dev is already deployed, skip to
3.3** and just collect the values. If not, create a temporary pool by hand so the login flow can be built
and tested; delete it when the CDK one exists.

### 3.1 Create the user pool (only if core-dev is not deployed yet)

1. Platform region → **Amazon Cognito → User pools → Create user pool**.
2. **Application type: Single-page application (SPA)**. Name the application `sentinelstack-web`.
   (SPA = public client **without** a client secret — required, because the browser can't keep a secret.)
3. **Options for sign-in identifiers: Email**. Self-registration: enabled. Required attributes: `email`.
4. **Return URL**: `http://localhost:3000/auth/callback/` (with the trailing slash).
5. **Create user directory**.

### 3.2 Configure it

1. **Sign-up → Custom attributes → Add custom attributes** → name `org_id`, type String, max length 64,
   **Mutable** ticked → Save.
2. **Groups → Create group** → `admin`. Again → `viewer`.
3. **App clients → sentinelstack-web → Login pages → Edit managed login pages configuration**:
   - Allowed callback URLs: `http://localhost:3000/auth/callback/` (add the CloudFront one in Part 4).
   - Allowed sign-out URLs: `http://localhost:3000/login/`.
   - OAuth 2.0 grant types: **Authorization code grant** only.
   - OpenID Connect scopes: **openid**, **email**, **profile**.
   - Save.
4. **App clients → sentinelstack-web → Attribute permissions**: make sure `custom:org_id` is **readable**
   (it is by default). Without this it won't appear in the ID token.
5. **Branding → Domain**: if no domain exists, **Actions → Create Cognito domain** → prefix
   `sentinelstack-dev-<something unique>`.

### 3.3 Collect the values for the frontend

| Frontend variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_COGNITO_DOMAIN` | User pool → **Branding → Domain** → e.g. `https://sentinelstack-dev-xyz.auth.ap-south-1.amazoncognito.com` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | User pool → **App clients** → client ID |
| `NEXT_PUBLIC_COGNITO_REDIRECT_URI` | `http://localhost:3000/auth/callback/` locally; `https://<cloudfront-domain>/auth/callback/` for the deployed build |
| `NEXT_PUBLIC_COGNITO_LOGOUT_URI` | `http://localhost:3000/login/` locally; `https://<cloudfront-domain>/login/` deployed |

The domain and client ID are public identifiers, not secrets — they're compiled into the JavaScript bundle.

### 3.4 Create a test user

1. **Users → Create user** → your email, **Send an email invitation** → Create.
2. Open the user → **Edit user attributes** → `custom:org_id` = `org-team8` → Save.
3. **Add user to group → admin**.

### 3.5 Test locally

```bash
cd frontend
cp .env.example .env.local      # then fill in the 4 Cognito values (leave NEXT_PUBLIC_API_URL empty)
npm install
npm run dev
```

Open `http://localhost:3000` → **Sign in** → Cognito page → sign in with the invited user (set a new
password) → you land on **Accounts** with your email bottom-left. The API calls still use mock data until
Track B's API URL is set.

---

## Part 4 — Host the web app on S3 + CloudFront (Week 1 Thursday: "login works on the dev URL")

This is what Track A's **web** CDK stack will own. If it's already deployed, ask A for the bucket name and
distribution ID and skip to 4.4.

### 4.1 Bucket (private)

1. Platform region → **S3 → Create bucket** → name `sentinelstack-web-dev-<accountId>`.
2. **Block all public access: On** (CloudFront reads it through OAC; the bucket is never public).
3. Default encryption SSE-S3 → **Create bucket**.

### 4.2 CloudFront Function for clean URLs

Next.js exports `/findings/index.html`. S3 behind OAC doesn't map `/findings/` to `index.html` by itself.

1. **CloudFront → Functions → Create function** → name `sentinel-index-rewrite` → runtime
   **cloudfront-js-2.0**.
2. Replace the code with:

   ```js
   function handler(event) {
     var request = event.request;
     var uri = request.uri;
     if (uri.endsWith("/")) {
       request.uri += "index.html";
     } else if (!uri.includes(".")) {
       request.uri += "/index.html";
     }
     return request;
   }
   ```

3. **Save changes → Publish → Publish function**.

### 4.3 Distribution

1. **CloudFront → Distributions → Create distribution**.
2. Origin: choose the bucket from 4.1 (the `…s3.ap-south-1.amazonaws.com` one, **not** a website endpoint).
3. **Origin access: Origin access control settings (recommended) → Create new OAC** → defaults → Create.
4. Viewer protocol policy: **Redirect HTTP to HTTPS**. Cache policy: **CachingOptimized**.
5. **Function associations → Viewer request → CloudFront Functions → `sentinel-index-rewrite`**.
6. WAF: **Do not enable security protections** (cost). Price class: **Use only North America and Europe**
   or **…and Asia** (cheaper than all edge locations).
7. Default root object: `index.html` → **Create distribution**.
8. A yellow banner says the bucket policy must be updated → **Copy policy** → S3 bucket → **Permissions →
   Bucket policy → Edit** → paste → Save.
9. **Error pages → Create custom error response**: HTTP 403 → customize → `/404.html`, response code 404.
   Repeat for 404.
10. Note the domain `dxxxxxxxx.cloudfront.net`. Deployment takes ~5 minutes.

### 4.4 Point Cognito at the dev URL

Cognito → app client → **Login pages → Edit** → add
`https://dxxxxxxxx.cloudfront.net/auth/callback/` to callback URLs and
`https://dxxxxxxxx.cloudfront.net/login/` to sign-out URLs → Save.

### 4.5 Build and upload

Create `frontend/.env.production.local` (git-ignored) with the deployed values:

```bash
NEXT_PUBLIC_COGNITO_DOMAIN=https://sentinelstack-dev-xyz.auth.ap-south-1.amazoncognito.com
NEXT_PUBLIC_COGNITO_CLIENT_ID=<client id>
NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://dxxxxxxxx.cloudfront.net/auth/callback/
NEXT_PUBLIC_COGNITO_LOGOUT_URI=https://dxxxxxxxx.cloudfront.net/login/
NEXT_PUBLIC_API_URL=            # Track B's API Gateway URL once /me works; empty = demo data
```

Then:

```bash
cd frontend
npm run build                                    # writes out/
aws s3 sync out/ s3://sentinelstack-web-dev-<accountId>/ --delete --profile sentinel
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*" --profile sentinel
```

Or, without the CLI: S3 console → bucket → **Upload** → drag the *contents* of `frontend/out/` (not the
folder itself) → Upload; then CloudFront → distribution → **Invalidations → Create** → `/*`.

**Done when:** `https://dxxxxxxxx.cloudfront.net` → Sign in → Cognito → back on Accounts with your email.

### 4.6 When Track B's API is live

Ask B to allow CORS from `https://dxxxxxxxx.cloudfront.net` and `http://localhost:3000`, then set
`NEXT_PUBLIC_API_URL` and rebuild/upload. The yellow "Demo mode" banner disappears and **Settings →
Connection** shows *Live API · Healthy*.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Cognito shows `redirect_mismatch` | The redirect URI in the build doesn't exactly match a callback URL on the app client — check `https`, domain and the trailing `/`. |
| "Sign-in response did not match this browser session" | You started sign-in on `localhost` and finished on CloudFront (or vice versa), or opened the link in another tab. Start again from `/login/`. |
| CloudFront returns `AccessDenied` XML | Bucket policy from step 4.3.8 is missing, or files were uploaded inside an `out/` folder instead of at the bucket root. |
| `/findings/` shows 404 but `/` works | The CloudFront Function isn't associated as **Viewer request**, or wasn't published. |
| API calls fail with "Cannot reach the SentinelStack API" | CORS not configured for your origin, or wrong `NEXT_PUBLIC_API_URL`. Check the browser console. |
| Stack creation fails on `PublicBucketPolicy` | Account-level Block Public Access for policies is on — see 2.1. |
| Stack creation fails on `UnencryptedVolume` | EBS encryption by default is on — see 2.1. |
