# Week 1 — Track C: AWS steps

Everything in AWS that Track C has to do in Week 1, as click-by-click steps. The code side (web app,
login flow, target stack template, deploy scripts) is already in the repo — these steps put it into AWS.

| Plan day | Task | Part | Time |
|---|---|---|---|
| Wednesday | Deploy the known-insecure target stack | [Part A](#part-a--deploy-the-insecure-target-stack-wednesday) | ~30 min |
| Thursday | Cognito sign-in for the web app | [Part B](#part-b--cognito-sign-in-thursday) | ~40 min |
| Thursday | Host the web app on S3 + CloudFront | [Part C](#part-c--host-the-web-app-on-s3--cloudfront-thursday) | ~45 min |
| Saturday | Demo prep | [Part D](#part-d--saturday-demo-checklist) | ~15 min |

**Before you start** you need the Day-1 checklist done ([aws-console-guide.md](aws-console-guide.md)):
your own IAM user `dev-c` with MFA, and for Part C step C9 the AWS CLI profile `sentinel`.

---

## 0. Read this first

### 0.1 Three habits that prevent 90% of problems

1. **Check the region before every step.** The region name is in the top-right of the console, next to
   your user name. Resources created in the wrong region are invisible from the right one. Each step below
   says which region it needs.
2. **Copy values, don't retype them.** IDs and URLs must match exactly — one missing `/` breaks sign-in.
3. **Write down every resource you create** in the [runbook](../runbook.md) table as you go.

### 0.2 Your values sheet

Copy this table into a private note on your laptop (not into the repo) and fill it in as you go.
None of these are secrets, but keeping them in one place saves time.

| # | Value | Where you get it | Your value |
|---|---|---|---|
| V1 | AWS account ID (12 digits) | Step A1 | |
| V2 | Platform region | Team decision (e.g. `ap-south-1`) | |
| V3 | Target region | Team decision (e.g. `us-east-1`) | |
| V4 | Cognito user pool ID | Step B3 | |
| V5 | Cognito domain URL | Step B3 | |
| V6 | Cognito app client ID | Step B3 | |
| V7 | Web bucket name | Step C1 | |
| V8 | CloudFront distribution ID | Step C4 | |
| V9 | CloudFront domain (`dxxxx.cloudfront.net`) | Step C4 | |

This guide uses `ap-south-1` (Asia Pacific (Mumbai)) as the platform region and `us-east-1`
(US East (N. Virginia)) as the target region. If your team picked others, use those instead.

### 0.3 Sign in

1. Open the sign-in URL for your account: IAM users sign in at
   `https://<V1>.signin.aws.amazon.com/console` (ask whoever made `dev-c` if you don't have it).
2. Choose **IAM user**, enter account ID, user name `dev-c`, your password → **Sign in**.
3. Enter the 6-digit code from your authenticator app.
4. You are in when the top bar shows **dev-c @ <account ID>** at the right.

---

## Part A — Deploy the insecure target stack (Wednesday)

**Goal (plan: "Done when: deploys in the target region"):** the CloudFormation stack
`sentinel-target-insecure` reaches `CREATE_COMPLETE` in the target region.

**What it creates:** a public (empty) S3 bucket, an IAM user with a console password and no MFA, an inline
`*:*` policy, three wide-open security groups, an unencrypted 1 GB EBS volume, a KMS key with rotation off,
and a Lambda function whose role has AdministratorAccess.

**Why it's safe:** the user and the Lambda role also carry an explicit **Deny everything** policy (a Deny
always beats an Allow), the bucket holds no objects, and no EC2 instance uses the security groups.
**Cost:** about $1.10 a month, billed by the hour — around $0.04 a day.

### A1. Find your account ID → V1

1. Click your user name (top-right).
2. The menu shows **Account ID** with a copy icon. Copy it into **V1** (12 digits, no dashes).

### A2. Switch to the target region

1. Click the region name (top-right, left of your user name).
2. Choose **US East (N. Virginia) us-east-1**.
3. Confirm it now reads **N. Virginia**. Stay in this region for all of Part A.

### A3. Pre-check 1 — a default VPC exists

The three security groups are created in the region's default VPC. If there is none, the stack fails.

1. In the top search bar type **VPC** → open **VPC**.
2. Left menu → **Your VPCs**.
3. Look at the **Default VPC** column. One row must say **Yes**.
4. **If no row says Yes:** click **Actions → Create default VPC → Create default VPC**. Wait until it
   appears, then add "default VPC created in us-east-1" to the runbook.

### A4. Pre-check 2 — EBS encryption by default is OFF

If "always encrypt new EBS volumes" is on, AWS refuses to create the unencrypted test volume.

1. Search bar → **EC2** → open **EC2** (still in N. Virginia).
2. On the **EC2 Dashboard**, find the **Account attributes** box on the right → click
   **Data protection and security**.
3. Look at the **EBS encryption** section → **Always encrypt new EBS volumes**.
   - **Disabled** → good, continue to A5.
   - **Enabled** → click **Manage** → untick **Enable** → **Update EBS encryption**. Add to the runbook:
     *"us-east-1 EBS default encryption turned OFF for the test — turn back ON at teardown."*

### A5. Pre-check 3 — S3 Block Public Access allows public bucket *policies*

The test bucket is made public with a bucket policy. If public policies are blocked for the whole account,
the stack fails at `PublicBucketPolicy`.

> This setting is **account-wide** (all regions). Turning off the two *policy* options does **not** make
> any bucket public by itself — a bucket only becomes public if someone also attaches a public policy to it.
> The two *ACL* options stay on.

1. Search bar → **S3** → open **S3**.
2. Left menu → **Block Public Access settings for this account**.
3. You see four options. Check the state of:
   - *Block public access to buckets and objects granted through **new public bucket or access point policies***
   - *Block public and cross-account access to buckets and objects through **any public bucket or access point policies***
4. **If both show Off** → continue to A6.
5. **If either shows On:** click **Edit** → untick **only those two** (leave the two "ACLs" options ticked)
   → **Save changes** → type `confirm` → **Confirm**. Add to the runbook:
   *"Account S3 BPA policy options turned OFF for the test — turn back ON at teardown."*

### A6. Make a password for the test user

The stack needs a console password for the MFA-less test user. Nobody will ever sign in with it.

1. Open your password manager (or any generator) and make a **24-character** password with uppercase,
   lowercase, digits and a symbol. Example shape: `k7#Vq2mW9!pL4xR8@tN3zB6s`.
2. Keep it on your clipboard. You don't need to save it.

### A7. Get the template file

The file is `tools/target-insecure.yaml` in the repo. If you haven't cloned the repo:

```powershell
git clone https://github.com/lahari-66/Sentinel_Stack.git
```

### A8. Create the stack

1. **Check the region is N. Virginia.**
2. Search bar → **CloudFormation** → open it.
3. Click **Create stack** (orange) → **With new resources (standard)**.

**Screen "Create stack":**

4. **Prerequisite – Prepare template:** *Choose an existing template*.
5. **Specify template:** *Upload a template file* → **Choose file** → pick
   `Sentinel_Stack/tools/target-insecure.yaml`.
6. Click **Next**. *(If you get "Template format error", you picked a different file.)*

**Screen "Specify stack details":**

7. **Stack name:** `sentinel-target-insecure` — exactly this, because the CI test looks it up by name.
8. **Parameters → ConsoleUserPassword:** paste the password from A6.
9. Click **Next**.

**Screen "Configure stack options":**

10. **Tags → Add new tag:** Key `project`, Value `sentinelstack`.
11. **Permissions:** leave empty.
12. **Stack failure options:** leave *Roll back all stack resources*.
13. Scroll to the bottom → **Next**.

**Screen "Review and create":**

14. Scroll to the bottom. Tick
    **I acknowledge that AWS CloudFormation might create IAM resources with custom names.**
15. Click **Submit**.

### A9. Watch it build

1. You land on the stack page. Status is **CREATE_IN_PROGRESS**.
2. Open the **Events** tab and click the refresh icon every 30 seconds.
3. After 2–3 minutes the status becomes **CREATE_COMPLETE** (green). ✅

**If it shows ROLLBACK_IN_PROGRESS / ROLLBACK_COMPLETE instead:**

1. In **Events**, scroll to the **oldest** row whose status is **CREATE_FAILED** — that is the real cause
   (later failures are just "cancelled").
2. Match it:

   | Failed resource | Message contains | Fix |
   |---|---|---|
   | `PublicBucketPolicy` | `AccessDenied` / `BlockPublicPolicy` | Step A5 |
   | `UnencryptedVolume` | encryption by default | Step A4 |
   | a security group | `No default VPC` / `VPCIdNotSpecified` | Step A3 |
   | `ConsoleUser` | `PasswordPolicyViolation` | Make a longer password with all character types (A6) |
   | anything | `already exists` | A previous attempt left it behind — delete the old stack first |

3. Delete the failed stack: **Delete** → **Delete**. Wait until it disappears.
4. Fix the cause and repeat A8.

### A10. Verify it worked

1. Open the **Outputs** tab. You should see **9 rows**:
   `AdminFunctionArn`, `AllOpenSecurityGroupId`, `ConsoleUserArn`, `NoRotationKeyArn`, `PublicBucketArn`,
   `PublicBucketName`, `RdpOpenSecurityGroupId`, `SshOpenSecurityGroupId`, `UnencryptedVolumeId`.
2. **Take a screenshot** of the Outputs tab (for the Saturday demo).
3. Spot-check three resources:
   - **S3** → Buckets → `sentinel-target-public-<account>-us-east-1`. The **Access** column says
     **Public**. ✅
   - **EC2 → Security Groups** (N. Virginia) → `sentinel-target-all-open` → **Inbound rules** shows
     *All traffic · 0.0.0.0/0*. ✅
   - **IAM → Users** → `sentinel-target-console-user-us-east-1` → **Permissions** tab lists two inline
     policies: `sentinel-target-star-star` and `sentinel-target-deny-all`. ✅

> **Expected warning emails / banners.** AWS may flag the open security groups or the public bucket
> (Trusted Advisor, Security Hub, an email). That is exactly what the stack is for. Don't fix them — the
> scanner has to find them.

### A11. Record it

Add rows to [docs/runbook.md](../runbook.md): the stack name, region, date, and any setting you changed
in A3–A5. Tell the team in the group chat: *"target stack is up in us-east-1"*.

### A12. When to delete it (and how)

Keep it while the team is testing (Weeks 1–3). When it isn't needed for a while:

1. CloudFormation (N. Virginia) → select `sentinel-target-insecure` → **Delete** → **Delete**.
2. Wait for it to disappear (the KMS key is scheduled for deletion in 7 days; no charge after that).
3. Undo what you changed: EBS default encryption back **on** (A4), the two S3 BPA policy options back
   **on** (A5).
4. Update the runbook.

**✅ Part A done when:** the stack shows `CREATE_COMPLETE` and the Outputs screenshot is saved.

---

## Part B — Cognito sign-in (Thursday)

**Goal:** a Cognito user pool with a login page, so that the web app's **Sign in** button works —
first on your laptop, then on the CloudFront URL (Part C).

### B0. Check with Track A first

The Cognito user pool is part of Track A's **core** CDK stack (plan, Tuesday). Ask them in the chat:
*"Is core-dev deployed? What's the user pool ID?"* Or check yourself:

1. Switch region to **Asia Pacific (Mumbai) ap-south-1** (platform region).
2. Search bar → **Cognito** → **User pools**.
   - **A pool from the CDK stack exists** (name like `sentinelstack-dev…`) → **skip to B3** and only
     collect values; then do **B6–B8** if A hasn't (check each setting).
   - **No pool** → do B1–B8 to make a temporary one. When A's CDK pool arrives, switch the web app to it
     (change the values in `.env.local` / `.env.production.local`) and delete yours.

### B1. Create the user pool

1. Region: **Mumbai (ap-south-1)**. Cognito → **User pools** → **Create user pool**.

**Screen "Set up resources for your application":**

2. **Define your application → Application type:** select **Single-page application (SPA)**.
   *(This makes a public app client without a client secret — required, because anything in a browser is
   visible to users.)*
3. **Name your application:** `sentinelstack-web`.
4. **Configure options → Options for sign-in identifiers:** tick **Email** only.
5. **Self-registration:** tick **Enable self-registration**.
6. **Required attributes for sign-up:** `email` (it's preselected). Don't add more.
7. **Add a return URL:** `http://localhost:3000/auth/callback/`
   — type it exactly: `http`, not `https`; `localhost:3000`; **ending in a slash**.
8. Click **Create user directory**.
9. You land on a page titled after your app with a "quick setup guide". Ignore the code samples (they're
   for other frameworks) and click **Go to overview** (or open the pool from **User pools**).

### B2. Rename the pool (optional, helps later)

The pool gets an auto-generated name like `User pool - abc123`.
**Overview → Rename** → `sentinelstack-dev-manual` → **Save changes**. The `manual` reminds everyone this
one isn't from CDK.

### B3. Collect the three values → V4, V5, V6

1. **V4 — User pool ID:** on the pool's **Overview**, copy **User pool ID** (looks like
   `ap-south-1_AbC123xyz`).
2. **V5 — Domain:** left menu → **Branding → Domain**.
   - The setup normally creates a **Cognito domain** automatically, shown like
     `https://ap-south-1abcd1234.auth.ap-south-1.amazoncognito.com`. Copy it **without** a trailing slash.
   - **If the Domain section is empty:** **Actions → Create Cognito domain** → prefix
     `sentinelstack-dev-<your initials><4 digits>` (must be globally unique, lowercase) → Branding version
     **Managed login** → **Create Cognito domain**. Then copy it.
3. **V6 — App client ID:** left menu → **Applications → App clients** → `sentinelstack-web` → copy
   **Client ID** (about 26 lowercase letters/digits).
   On the same page, **Client secret** must say **–** / not present. If it shows a secret, the wrong
   application type was chosen in B1 — create a new app client of type SPA.

### B4. Add the custom attribute `org_id`

The backend uses `custom:org_id` to keep organisations apart.

1. Left menu → **Authentication → Sign-up**.
2. Scroll to **Custom attributes** → **Add custom attributes**.
3. **Name:** `org_id` (Cognito shows it as `custom:org_id`). **Type:** String. **Min length:** 1.
   **Max length:** 64. **Mutable:** ✅ ticked.
4. **Save changes**.
   > Custom attributes can't be deleted or renamed later — double-check the spelling before saving.

### B5. Create the groups `admin` and `viewer`

1. Left menu → **User management → Groups** → **Create group**.
2. **Group name:** `admin` → leave the rest → **Create group**.
3. **Create group** again → `viewer` → **Create group**.

### B6. Configure the login page settings of the app client

1. Left menu → **Applications → App clients** → `sentinelstack-web`.
2. Open the **Login pages** tab → **Managed login pages configuration** → **Edit**.
3. Set every field like this:

   | Field | Value |
   |---|---|
   | Allowed callback URLs | `http://localhost:3000/auth/callback/` *(you add the CloudFront one in C7)* |
   | Allowed sign-out URLs | **Add sign-out URL** → `http://localhost:3000/login/` |
   | Identity providers | **Cognito user pool directory** |
   | OAuth 2.0 grant types | **Authorization code grant** only (untick Implicit if ticked) |
   | OpenID Connect scopes | **OpenID**, **Email**, **Profile** (untick Phone and `aws.cognito.signin.user.admin`) |

4. **Save changes**.

### B7. Make sure the ID token carries `org_id` and the login page has a style

1. **Attribute permissions:** App clients → `sentinelstack-web` → **Attribute permissions** tab (or
   *Edit attribute read and write permissions*). In the **Read** column, `custom:org_id` and `email` must be
   ticked. If not → **Edit** → tick them → **Save changes**.
2. **Managed login style:** left menu → **Branding → Managed login**. Under **Styles** there must be a
   style whose **App client** is `sentinelstack-web`.
   If the list is empty → **Create a style** → app client `sentinelstack-web` → **Create**. (Without a
   style, the login page shows an error.) You can leave the default look.

### B8. Create your test user

1. Left menu → **User management → Users** → **Create user**.
2. **Invitation message:** *Send an email invitation*.
3. **Email address:** your own email. Tick **Mark email address as verified**.
4. **Temporary password:** *Generate a password*.
5. **Create user**. Cognito emails you a temporary password (sender `no-reply@verificationemail.com`;
   check spam).
6. Open the new user (click the user name) →
   **User attributes → Edit** → find `custom:org_id` (use **Add attribute** if it isn't listed) → value
   `org-team8` → **Save changes**.
7. Still on the user page → **Group memberships → Add user to group** → tick `admin` → **Add**.

> **If the console won't let you set `custom:org_id`**, open **CloudShell** (the `>_` icon in the top bar,
> still in Mumbai) and run, with your pool ID and email:
>
> ```bash
> aws cognito-idp admin-update-user-attributes \
>   --user-pool-id ap-south-1_AbC123xyz \
>   --username you@example.com \
>   --user-attributes Name=custom:org_id,Value=org-team8
> ```

### B9. Test sign-in on your laptop

1. In the repo, go to `frontend/` and create `.env.local` (copy `.env.example`):

   ```powershell
   cd Sentinel_Stack\frontend
   copy .env.example .env.local
   notepad .env.local
   ```

2. Fill in (leave `NEXT_PUBLIC_API_URL` empty — the API isn't live yet):

   ```ini
   NEXT_PUBLIC_API_URL=
   NEXT_PUBLIC_COGNITO_DOMAIN=<V5, e.g. https://ap-south-1abcd1234.auth.ap-south-1.amazoncognito.com>
   NEXT_PUBLIC_COGNITO_CLIENT_ID=<V6>
   NEXT_PUBLIC_COGNITO_REDIRECT_URI=http://localhost:3000/auth/callback/
   NEXT_PUBLIC_COGNITO_LOGOUT_URI=http://localhost:3000/login/
   NEXT_PUBLIC_USE_MOCKS=
   ```

3. Save, then run:

   ```powershell
   npm install
   npm run dev
   ```

4. Open `http://localhost:3000`. You are sent to the login page. The button now says
   **Sign in with SentinelStack** (not "Enter demo mode") — that proves the Cognito values were read.
   *(If it still says "Enter demo mode", stop the server with Ctrl+C and start it again — `.env.local` is
   read only at start-up.)*
5. Click **Sign in with SentinelStack** → the Cognito page opens → sign in with your email and the
   temporary password → set a new password.
6. You land on **Accounts**. Bottom-left shows **your email** and **Admin**. ✅ The data is still the demo
   data (yellow banner) until Track B's API is connected.
7. Click **Sign out** → you return to the login page.

| Problem | Fix |
|---|---|
| Cognito page says **redirect_mismatch** | The callback URL in B6 and `NEXT_PUBLIC_COGNITO_REDIRECT_URI` differ. Both must be exactly `http://localhost:3000/auth/callback/`. |
| Cognito page says **An error was encountered with the requested page** | Managed login style missing (B7.2), or the domain in `.env.local` is wrong. |
| **Sign-in failed: invalid_grant** | The code was already used — click **Try again**. Happens if you refresh the callback page. |
| Bottom-left says **Viewer** | User isn't in the `admin` group (B8.7). Sign out and in again after adding. |
| **unauthorized_client** | Authorization code grant not ticked (B6). |

**✅ Part B done when:** you can sign in and out on `http://localhost:3000` with your Cognito user.

---

## Part C — Host the web app on S3 + CloudFront (Thursday)

**Goal (plan: "Done when: login works on the dev URL"):** `https://<V9>` loads the app over HTTPS and
Cognito sign-in works there.

**How it fits together:** the app is plain files (HTML/JS/CSS) in a **private** S3 bucket. CloudFront
serves them over HTTPS and is the only thing allowed to read the bucket (Origin Access Control, "OAC").
A tiny CloudFront Function turns `/findings/` into `/findings/index.html`.

> **Check with Track A first.** The plan has A's **web** CDK stack create the bucket and distribution.
> If it already exists, ask A for the bucket name (V7) and distribution ID (V8), check C3 and C5 are
> configured, then jump to C6. Otherwise do everything below and tell A the names so the CDK stack can
> replace these resources later.

**Cost:** S3 storage for ~2 MB is under $0.01/month. CloudFront's always-free tier (1 TB out and
10 million requests a month) covers this project.

### C1. Create the private bucket → V7

1. Region: **Mumbai (ap-south-1)**. Search bar → **S3** → **Create bucket**.
2. **Bucket type:** General purpose.
3. **Bucket name:** `sentinelstack-web-dev-<V1>` (e.g. `sentinelstack-web-dev-123456789012`). Write it in
   **V7**.
4. **Object Ownership:** *ACLs disabled (recommended)*.
5. **Block Public Access settings for this bucket:** ✅ **Block all public access** — leave it **on**.
   The bucket is never public; CloudFront reads it with OAC.
6. **Bucket Versioning:** Disable. **Tags:** `project` = `sentinelstack`.
7. **Default encryption:** *SSE-S3*, Bucket Key **Enable**.
8. **Create bucket**. ✅ It appears in the list with Access *"Bucket and objects not public"*.

### C2. Build the app once (so there is something to upload)

On your laptop, in `Sentinel_Stack\frontend`:

```powershell
npm run build
```

It ends with `✓ Exporting (2/2)` and creates the folder `frontend\out\`. For now this is a demo-mode build;
you rebuild with the real values in C8.

### C3. Create the CloudFront Function

1. Search bar → **CloudFront** (it's a global service; the region selector shows "Global").
2. Left menu → **Functions** → **Create function**.
3. **Name:** `sentinel-index-rewrite`. **Description:** `map /path/ to /path/index.html`.
   **Runtime:** **cloudfront-js-2.0**. → **Create function**.
4. On the **Build** tab, delete all the sample code in the editor and paste the full contents of
   `frontend/deploy/cloudfront-index-rewrite.js` from the repo.
5. **Save changes**.
6. Optional test: **Test** tab → Event type *Viewer request*, URL path `/findings/` → **Test function**.
   The output shows `"uri": "/findings/index.html"`. ✅
7. **Publish** tab → **Publish function**. The status must say it's published — an unpublished function
   can't be attached.

### C4. Create the distribution → V8, V9

The CloudFront console has been redesigned more than once, so your screens may be ordered a little
differently. **The settings in the table are what matter** — find each one wherever it appears.

1. CloudFront → **Distributions** → **Create distribution**.
2. If asked for a **pricing plan**, choose **Pay as you go** (the always-free tier covers this project).
   If asked for a **name**, use `sentinelstack-web-dev`. Distribution type: **Single website or app**.
3. Set these:

   | Setting | Value | Why |
   |---|---|---|
   | Origin type / Origin domain | **Amazon S3** → choose `sentinelstack-web-dev-<V1>.s3.ap-south-1.amazonaws.com` from the list | Must be the bucket itself, **not** an "s3-website" endpoint |
   | Origin access | **Origin access control settings (recommended)** → **Create new OAC** → defaults (*Sign requests*) → **Create**. In the newer wizard this is the option **"Allow private S3 bucket access to CloudFront"** | Lets only CloudFront read the private bucket |
   | Viewer protocol policy | **Redirect HTTP to HTTPS** | Everything over HTTPS |
   | Allowed HTTP methods | **GET, HEAD** | Static site |
   | Cache policy | **CachingOptimized** (*use recommended cache settings*) | |
   | Web Application Firewall (WAF) | **Do not enable security protections** | WAF costs money; not in scope |
   | Price class | **Use North America, Europe, Asia, Middle East, and Africa** (or "Use all edge locations" if that's the only choice) | |
   | Default root object | `index.html` (if shown on this screen; otherwise set in C5) | `/` serves the app |
   | Alternate domain name (CNAME) | leave empty | Custom domain is Week 4 |

4. **Create distribution**.
5. **Bucket policy for OAC.**
   - If a yellow/blue banner says *"The S3 bucket policy needs to be updated"* → click **Copy policy** →
     click the link to the bucket (or S3 → your bucket) → **Permissions** tab → **Bucket policy** →
     **Edit** → paste → **Save changes**.
   - If you used "Allow private S3 bucket access to CloudFront", the console updates the policy itself.
   - Either way, check in C6.
6. From the distribution page copy:
   - **V8 — Distribution ID** (like `E1ABCDEF2GHIJK`)
   - **V9 — Distribution domain name** (like `d1a2b3c4d5e6f7.cloudfront.net`)
7. **Last modified** shows *Deploying* for ~5 minutes. Carry on meanwhile.

### C5. Finish the distribution settings

Open the distribution (CloudFront → Distributions → your ID).

**a) Default root object**

1. **General** tab → **Settings** → **Edit**.
2. **Default root object:** `index.html` → **Save changes**.

**b) Attach the function**

1. **Behaviors** tab → select the **Default (\*)** row → **Edit**.
2. Scroll to **Function associations**.
3. **Viewer request:** Function type **CloudFront Functions** → Function ARN/Name **sentinel-index-rewrite**.
   Leave Viewer response, Origin request and Origin response empty.
4. **Save changes**.

**c) Error pages**

1. **Error pages** tab → **Create custom error response**.
2. **HTTP error code:** `403: Forbidden`. **Error caching minimum TTL:** `10`.
   **Customize error response:** Yes. **Response page path:** `/404.html`. **HTTP response code:**
   `404: Not Found`. → **Create custom error response**.
3. Repeat with **HTTP error code** `404: Not Found` → same path `/404.html`, response `404`.

   *(S3 answers 403 — not 404 — for missing files when accessed through OAC, which is why both are needed.)*

### C6. Check the bucket policy

1. S3 → `sentinelstack-web-dev-<V1>` → **Permissions** → **Bucket policy**.
2. It must contain a statement like this (your IDs instead of the placeholders):

   ```json
   {
     "Sid": "AllowCloudFrontServicePrincipal",
     "Effect": "Allow",
     "Principal": { "Service": "cloudfront.amazonaws.com" },
     "Action": "s3:GetObject",
     "Resource": "arn:aws:s3:::sentinelstack-web-dev-<V1>/*",
     "Condition": {
       "StringEquals": {
         "AWS:SourceArn": "arn:aws:cloudfront::<V1>:distribution/<V8>"
       }
     }
   }
   ```

3. If the policy is empty, go back to C4 step 5. **Block all public access stays ON** — this policy works
   with it on.

### C7. Tell Cognito about the CloudFront URL

1. Region **Mumbai** → Cognito → your pool → **Applications → App clients** → `sentinelstack-web` →
   **Login pages** → **Edit**.
2. **Allowed callback URLs → Add another URL:** `https://<V9>/auth/callback/`
   (e.g. `https://d1a2b3c4d5e6f7.cloudfront.net/auth/callback/`). Keep the localhost one.
3. **Allowed sign-out URLs → Add sign-out URL:** `https://<V9>/login/`. Keep the localhost one.
4. **Save changes**.

### C8. Create the production settings file

1. In `Sentinel_Stack\frontend`:

   ```powershell
   copy .env.production.example .env.production.local
   notepad .env.production.local
   ```

2. Fill it in:

   ```ini
   NEXT_PUBLIC_COGNITO_DOMAIN=<V5>
   NEXT_PUBLIC_COGNITO_CLIENT_ID=<V6>
   NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://<V9>/auth/callback/
   NEXT_PUBLIC_COGNITO_LOGOUT_URI=https://<V9>/login/
   NEXT_PUBLIC_API_URL=
   ```

   `.env.production.local` is git-ignored, so it never gets committed. `npm run build` uses it
   automatically, and it takes priority over `.env.local`.

### C9. Upload — choose ONE option

**Option 1 — deploy script (recommended, repeatable).** Needs the AWS CLI profile `sentinel` from Day 1.

```powershell
cd Sentinel_Stack\frontend
aws sts get-caller-identity --profile sentinel     # must show user/dev-c
powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -Bucket <V7> -DistributionId <V8>
```

The script builds, uploads (long cache for hashed files, no-cache for pages), and clears the CloudFront
cache. It ends with `Done. Changes are live in 1-2 minutes.`
If it says `AccessDenied`, your profile isn't `dev-c` or lacks permissions — check the first command.

**Option 2 — console only (no CLI).**

1. Rebuild with the production values: `npm run build` in `frontend`.
2. S3 → `sentinelstack-web-dev-<V1>` → **Objects** → **Upload**.
3. Open `frontend\out\` in File Explorer, select **everything inside it** (Ctrl+A) and **drag it onto the
   upload area**. *(Drag the contents, not the `out` folder itself — otherwise the files land under
   `out/` and the site shows AccessDenied. "Add files" also loses the subfolders, so use drag-and-drop.)*
4. Check the list includes `index.html`, `404.html`, and folders `_next/`, `accounts/`, `findings/`,
   `login/`, `auth/` … → **Upload**. Wait for **Upload succeeded** → **Close**.
5. CloudFront → your distribution → **Invalidations** → **Create invalidation** → object path `/*` →
   **Create invalidation**. Wait until status is **Completed** (~1 minute).

For later updates with Option 2, delete the old objects first (select all → **Delete**) so stale files
don't linger.

### C10. Test the dev URL

Wait until the distribution's **Last modified** shows a date (not *Deploying*). Then, in a private/incognito
window:

| # | Do | Expect |
|---|---|---|
| 1 | Open `https://<V9>` | Redirect to `/login/`, button **Sign in with SentinelStack** |
| 2 | Click it | Cognito login page |
| 3 | Sign in | Back on `https://<V9>/accounts/`, your email + Admin bottom-left |
| 4 | Click **Findings**, **Scans**, **Settings** | Each page loads |
| 5 | Press F5 on `/findings/` | Page reloads (no AccessDenied) — proves the function works |
| 6 | Open `https://<V9>/nope/` | The "Page not found" page |
| 7 | Open `http://<V9>` (http) | Redirects to https |
| 8 | **Sign out** | Back on `/login/` |

| Problem | Fix |
|---|---|
| `AccessDenied` XML on `/` | Bucket policy missing (C6) or files uploaded inside an `out/` folder (C9). |
| `/` works, `/findings/` shows AccessDenied or 404 | Function not published (C3.7) or not attached as **Viewer request** (C5b). |
| Button says **Enter demo mode** | `.env.production.local` missing or misnamed when you built. Fix, rebuild, re-upload. |
| Cognito **redirect_mismatch** | C7 URL differs from `NEXT_PUBLIC_COGNITO_REDIRECT_URI` — check `https`, the `d…cloudfront.net` name, and the trailing `/`. |
| Old version still showing | Invalidation not done/finished, or the browser cache — try incognito. |

### C11. Record and share

1. Runbook: bucket, CloudFront function, OAC, distribution, Cognito pool (if you made it).
2. Tell the team:
   - **Track A:** bucket name V7, distribution ID V8, function name — so the web CDK stack can take over.
   - **Track B:** please allow CORS origins `https://<V9>` and `http://localhost:3000` on the HTTP API,
     and set the JWT authorizer audience to the app client ID V6.

**✅ Part C done when:** test 1–8 in C10 pass on `https://<V9>`.

---

## Part D — Saturday demo checklist

Plan: *"Demo: login on the dev URL; target stack deployed. Retro together."* — it must be on the deployed
URL, never localhost.

Before the demo:

- [ ] CloudFormation (N. Virginia): `sentinel-target-insecure` is `CREATE_COMPLETE`.
- [ ] `https://<V9>` loads in an incognito window; you can sign in.
- [ ] Screenshots saved: stack Outputs, the app's Accounts page on the CloudFront URL.
- [ ] Runbook table up to date.
- [ ] Billing → **Cost Explorer**: spend so far noted in the runbook's weekly table.

During the demo (3 minutes):

1. Show the CloudFormation stack and its Outputs; name two misconfigurations it contains.
2. Open `https://<V9>` in incognito → sign in through Cognito → land on Accounts.
3. Click through Findings → open one → show the evidence panel (demo data until the API is live).
4. Sign out.

Week 1 Track C deliverables after this: ✅ login works · ✅ target stack + expected findings ·
✅ requirements + data model docs (OpenAPI is Track B's).
