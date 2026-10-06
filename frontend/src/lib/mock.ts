// In-memory stand-in for the SentinelStack API, used in demo mode (no NEXT_PUBLIC_API_URL).
// Data mirrors what a scan of tools/target-insecure.yaml should produce, so the screens look
// realistic before the backend lands. Delete nothing here when the API ships — demo mode stays
// useful for UI work and screenshots.

import type {
  Account,
  AuditEntry,
  CreateAccountResponse,
  Explanation,
  Finding,
  FindingFilters,
  Me,
  Page,
  Rule,
  Scan,
  Settings,
  Severity,
  SeverityCounts,
} from "./types";

const TARGET = "123456789012";
const OTHER = "210987654321";
const REGION = "us-east-1";
const ME = "demo@sentinelstack.dev";

export const RULES: Rule[] = [
  { rule_id: "S3-001", title: "Bucket effectively public", severity: "CRITICAL", service: "s3", description: "The bucket is readable or writable by anyone through its ACL or bucket policy, after account- and bucket-level Block Public Access are applied." },
  { rule_id: "S3-002", title: "Default encryption off", severity: "MEDIUM", service: "s3", description: "The bucket has no default server-side encryption configuration." },
  { rule_id: "S3-003", title: "Versioning off", severity: "LOW", service: "s3", description: "Object versioning is not enabled, so overwritten or deleted objects cannot be recovered." },
  { rule_id: "S3-004", title: "No deny for non-TLS requests", severity: "MEDIUM", service: "s3", description: "The bucket policy does not deny requests where aws:SecureTransport is false." },
  { rule_id: "IAM-001", title: "Root access keys exist", severity: "CRITICAL", service: "iam", description: "The root user has one or more active access keys." },
  { rule_id: "IAM-002", title: "Console user without MFA", severity: "HIGH", service: "iam", description: "An IAM user with a console password has no MFA device." },
  { rule_id: "IAM-003", title: "Access key older than 90 days", severity: "MEDIUM", service: "iam", description: "An active access key has not been rotated for more than 90 days." },
  { rule_id: "IAM-004", title: "Policy grants *:*", severity: "HIGH", service: "iam", description: "A policy allows every action on every resource." },
  { rule_id: "IAM-005", title: "Credentials unused 90+ days", severity: "MEDIUM", service: "iam", description: "A password or access key has not been used for more than 90 days." },
  { rule_id: "IAM-006", title: "Weak password policy", severity: "LOW", service: "iam", description: "The account password policy is missing or below the recommended strength." },
  { rule_id: "EC2-001", title: "SG allows 22 from anywhere", severity: "HIGH", service: "ec2", description: "A security group allows SSH (22) from 0.0.0.0/0 or ::/0." },
  { rule_id: "EC2-002", title: "SG allows 3389 from anywhere", severity: "HIGH", service: "ec2", description: "A security group allows RDP (3389) from 0.0.0.0/0 or ::/0." },
  { rule_id: "EC2-003", title: "SG allows all traffic from anywhere", severity: "CRITICAL", service: "ec2", description: "A security group allows all protocols and ports from 0.0.0.0/0 or ::/0." },
  { rule_id: "EC2-004", title: "Default SG has rules", severity: "LOW", service: "ec2", description: "A VPC default security group has inbound or outbound rules." },
  { rule_id: "EBS-001", title: "Unencrypted volume", severity: "MEDIUM", service: "ebs", description: "An EBS volume is not encrypted." },
  { rule_id: "EBS-002", title: "Public snapshot", severity: "CRITICAL", service: "ebs", description: "An EBS snapshot is shared with all AWS accounts." },
  { rule_id: "CT-001", title: "No multi-region trail", severity: "HIGH", service: "cloudtrail", description: "No CloudTrail trail is logging in all regions." },
  { rule_id: "CT-002", title: "Log file validation off", severity: "LOW", service: "cloudtrail", description: "A trail has log file integrity validation disabled." },
  { rule_id: "KMS-001", title: "CMK rotation off", severity: "LOW", service: "kms", description: "A customer-managed KMS key does not have automatic rotation enabled." },
  { rule_id: "LAMBDA-001", title: "Function role is admin / *:*", severity: "HIGH", service: "lambda", description: "A Lambda function's execution role has administrator or *:* permissions." },
];

const ruleById = new Map(RULES.map((r) => [r.rule_id, r]));
const WEIGHT: Record<Severity, number> = { CRITICAL: 20, HIGH: 10, MEDIUM: 4, LOW: 1 };

const iso = (daysAgo: number, hour = 9) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

function finding(ruleId: string, resource: string, evidence: Record<string, unknown>, daysAgo = 6): Finding {
  const rule = ruleById.get(ruleId)!;
  return {
    finding_id: `FIND#${ruleId}#${resource.length.toString(16)}${Math.abs(hash(resource)).toString(16)}`,
    account_id: TARGET,
    rule_id: ruleId,
    title: rule.title,
    service: rule.service,
    severity: rule.severity,
    resource_arn: resource,
    evidence,
    status: "open",
    first_seen: iso(daysAgo),
    last_seen: iso(0),
    resolved_at: null,
    suppressed: null,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const findings: Finding[] = [
  finding("S3-001", "arn:aws:s3:::sentinel-target-public-bucket", { policy_statement: { Effect: "Allow", Principal: "*", Action: "s3:GetObject" }, block_public_access: { account: false, bucket: false } }),
  finding("S3-003", "arn:aws:s3:::sentinel-target-public-bucket", { versioning: "Disabled" }),
  finding("S3-004", "arn:aws:s3:::sentinel-target-public-bucket", { secure_transport_deny: false }),
  finding("IAM-002", `arn:aws:iam::${TARGET}:user/sentinel-target-console-user`, { password_enabled: true, mfa_devices: 0 }),
  finding("IAM-004", `arn:aws:iam::${TARGET}:user/sentinel-target-console-user`, { policy: "inline:sentinel-target-star-star", statement: { Effect: "Allow", Action: "*", Resource: "*" } }),
  finding("IAM-006", `arn:aws:iam::${TARGET}:root`, { password_policy: null }, 6),
  finding("EC2-001", `arn:aws:ec2:${REGION}:${TARGET}:security-group/sg-0a1b2c3d4e5f60001`, { port: 22, cidr: "0.0.0.0/0", group_name: "sentinel-target-ssh-open" }),
  finding("EC2-002", `arn:aws:ec2:${REGION}:${TARGET}:security-group/sg-0a1b2c3d4e5f60002`, { port: 3389, cidr: "0.0.0.0/0", group_name: "sentinel-target-rdp-open" }),
  finding("EC2-003", `arn:aws:ec2:${REGION}:${TARGET}:security-group/sg-0a1b2c3d4e5f60003`, { protocol: "-1", cidr: "0.0.0.0/0", group_name: "sentinel-target-all-open" }, 3),
  finding("EC2-004", `arn:aws:ec2:${REGION}:${TARGET}:security-group/sg-0default00000001`, { inbound_rules: 1, outbound_rules: 1, vpc_id: "vpc-0default0001" }),
  finding("EBS-001", `arn:aws:ec2:${REGION}:${TARGET}:volume/vol-0a1b2c3d4e5f60001`, { encrypted: false, size_gb: 1 }),
  finding("KMS-001", `arn:aws:kms:${REGION}:${TARGET}:key/1234abcd-12ab-34cd-56ef-1234567890ab`, { key_rotation_enabled: false }, 3),
  finding("LAMBDA-001", `arn:aws:lambda:${REGION}:${TARGET}:function:sentinel-target-admin-fn`, { role: "sentinel-target-admin-fn-role", attached_policies: ["AdministratorAccess"] }),
  {
    ...finding("S3-002", "arn:aws:s3:::sentinel-target-old-logs", { default_encryption: null }, 10),
    status: "resolved",
    resolved_at: iso(2),
    last_seen: iso(3),
  },
  {
    ...finding("CT-002", `arn:aws:cloudtrail:${REGION}:${TARGET}:trail/org-trail`, { log_file_validation: false }, 8),
    status: "suppressed",
    suppressed: { by: ME, reason: "Org trail is managed by the security team; validation tracked in SEC-12.", at: iso(4) },
  },
];

function countsOf(list: Finding[]): SeverityCounts {
  const c: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of list) if (f.status === "open") c[f.severity.toLowerCase() as keyof SeverityCounts]++;
  return c;
}

function scoreOf(list: Finding[]): number {
  const penalty = list.filter((f) => f.status === "open").reduce((s, f) => s + WEIGHT[f.severity], 0);
  return Math.max(0, 100 - penalty);
}

// Scan history: score dips as insecure resources are added, then recovers slightly.
const history: Array<[number, number, number, number]> = [
  // daysAgo, score, new, resolved
  [6, 12, 12, 0],
  [5, 12, 0, 0],
  [4, 8, 1, 1],
  [3, 0, 2, 0],
  [2, 0, 0, 1],
  [1, 0, 0, 0],
];

const scans: Scan[] = history.map(([daysAgo, score, n, r], i) => ({
  scan_id: `${TARGET}#${iso(daysAgo, i % 2 ? 21 : 9)}`,
  account_id: TARGET,
  status: "succeeded",
  trigger: i === 0 ? "manual" : "schedule",
  started_at: iso(daysAgo, i % 2 ? 21 : 9),
  finished_at: new Date(Date.parse(iso(daysAgo, i % 2 ? 21 : 9)) + 94_000).toISOString(),
  score,
  counts: countsOf(findings),
  new: n,
  resolved: r,
  rule_errors: [],
}));

const accounts: Account[] = [
  {
    account_id: TARGET,
    role_arn: `arn:aws:iam::${TARGET}:role/SentinelStackScannerRole`,
    region: REGION,
    status: "connected",
    last_scan_id: scans[scans.length - 1].scan_id,
    last_score: scoreOf(findings),
    last_scan_at: scans[scans.length - 1].finished_at,
    created_at: iso(7),
  },
  {
    account_id: OTHER,
    role_arn: null,
    region: "ap-south-1",
    status: "pending",
    last_scan_id: null,
    last_score: null,
    last_scan_at: null,
    created_at: iso(1),
  },
];

const audit: AuditEntry[] = [
  { at: iso(7), user: ME, action: "account.create", target: TARGET, details: { region: REGION } },
  { at: iso(7, 10), user: ME, action: "account.verify", target: TARGET, details: { result: "connected" } },
  { at: iso(6), user: ME, action: "scan.start", target: TARGET, details: { trigger: "manual" } },
  { at: iso(4), user: ME, action: "finding.suppress", target: "CT-002 org-trail", details: { reason: "Managed by security team" } },
  { at: iso(1), user: ME, action: "account.create", target: OTHER, details: { region: "ap-south-1" } },
];

let settings: Settings = { name: "Team 8 Demo Org", alert_emails: [ME], scan_interval_hours: 12 };
const explanations = new Map<string, Explanation>();

const delay = <T,>(value: T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

class MockError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function audit_(action: string, target: string, details: Record<string, unknown> = {}) {
  audit.unshift({ at: new Date().toISOString(), user: ME, action, target, details });
}

function paginate<T>(items: T[], cursor: string | null | undefined, limit: number): Page<T> {
  const start = cursor ? Number(cursor) : 0;
  const next = start + limit;
  return { items: items.slice(start, next), next_cursor: next < items.length ? String(next) : null };
}

export const mockApi = {
  me: (): Promise<Me> => delay({ sub: "demo-user", email: ME, org_id: "demo-org", role: "admin" }),

  listAccounts: () => delay(accounts),

  createAccount(accountId: string, region: string): Promise<CreateAccountResponse> {
    if (!/^\d{12}$/.test(accountId)) return Promise.reject(new MockError(422, "AWS account ID must be 12 digits."));
    if (accounts.some((a) => a.account_id === accountId)) return Promise.reject(new MockError(409, "This account is already connected."));
    const externalId = crypto.randomUUID();
    const account: Account = { account_id: accountId, role_arn: null, region, status: "pending", last_scan_id: null, last_score: null, last_scan_at: null, created_at: new Date().toISOString() };
    accounts.push(account);
    audit_("account.create", accountId, { region });
    const params = new URLSearchParams({ stackName: "SentinelStackScanner", templateURL: "https://example-bucket.s3.amazonaws.com/onboarding.yaml", param_ExternalId: externalId });
    return delay({ account, external_id: externalId, quick_create_url: `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/quickcreate?${params}` });
  },

  verifyAccount(accountId: string, roleArn: string): Promise<Account> {
    const account = accounts.find((a) => a.account_id === accountId);
    if (!account) return Promise.reject(new MockError(404, "Account not found."));
    const ok = new RegExp(`^arn:aws:iam::${accountId}:role/.+`).test(roleArn);
    account.role_arn = roleArn;
    account.status = ok ? "connected" : "disconnected";
    audit_("account.verify", accountId, { result: account.status });
    if (!ok) return Promise.reject(new MockError(400, "AssumeRole failed: the role ARN must belong to this account and trust SentinelStack with the External ID."));
    return delay(account, 900);
  },

  deleteAccount(accountId: string): Promise<void> {
    const i = accounts.findIndex((a) => a.account_id === accountId);
    if (i >= 0) accounts.splice(i, 1);
    audit_("account.delete", accountId);
    return delay(undefined);
  },

  listScans: (accountId: string) =>
    delay(paginate(scans.filter((s) => s.account_id === accountId).slice().reverse(), null, 50)),

  getScan(scanId: string): Promise<Scan> {
    const scan = scans.find((s) => s.scan_id === scanId);
    return scan ? delay(scan) : Promise.reject(new MockError(404, "Scan not found."));
  },

  startScan(accountId: string): Promise<Scan> {
    const account = accounts.find((a) => a.account_id === accountId);
    if (!account || account.status !== "connected") return Promise.reject(new MockError(409, "Connect and verify the account before scanning."));
    const startedAt = new Date().toISOString();
    const scan: Scan = { scan_id: `${accountId}#${startedAt}`, account_id: accountId, status: "running", trigger: "manual", started_at: startedAt, finished_at: null, score: null, counts: { critical: 0, high: 0, medium: 0, low: 0 }, new: 0, resolved: 0, rule_errors: [] };
    scans.push(scan);
    audit_("scan.start", accountId, { trigger: "manual" });
    // Simulate the Step Functions execution finishing a few seconds later.
    setTimeout(() => {
      const own = findings.filter((f) => f.account_id === accountId);
      Object.assign(scan, { status: "succeeded", finished_at: new Date().toISOString(), score: scoreOf(own), counts: countsOf(own) });
      Object.assign(account, { last_scan_id: scan.scan_id, last_score: scan.score, last_scan_at: scan.finished_at });
    }, 4000);
    return delay(scan);
  },

  listFindings(filters: FindingFilters, cursor?: string | null, limit = 10): Promise<Page<Finding>> {
    const q = filters.q?.toLowerCase();
    const items = findings.filter(
      (f) =>
        (!filters.account_id || f.account_id === filters.account_id) &&
        (!filters.severity || f.severity === filters.severity) &&
        (!filters.service || f.service === filters.service) &&
        (!filters.status || f.status === filters.status) &&
        (!filters.rule_id || f.rule_id === filters.rule_id) &&
        (!q || f.resource_arn.toLowerCase().includes(q)),
    );
    const order: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    items.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.rule_id.localeCompare(b.rule_id));
    return delay(paginate(items, cursor, limit));
  },

  getFinding(id: string): Promise<Finding> {
    const f = findings.find((x) => x.finding_id === id);
    return f ? delay(f) : Promise.reject(new MockError(404, "Finding not found."));
  },

  suppress(id: string, reason: string): Promise<Finding> {
    const f = findings.find((x) => x.finding_id === id);
    if (!f) return Promise.reject(new MockError(404, "Finding not found."));
    f.status = "suppressed";
    f.suppressed = { by: ME, reason, at: new Date().toISOString() };
    audit_("finding.suppress", `${f.rule_id} ${f.resource_arn}`, { reason });
    return delay(f);
  },

  unsuppress(id: string): Promise<Finding> {
    const f = findings.find((x) => x.finding_id === id);
    if (!f) return Promise.reject(new MockError(404, "Finding not found."));
    f.status = "open";
    f.suppressed = null;
    audit_("finding.unsuppress", `${f.rule_id} ${f.resource_arn}`);
    return delay(f);
  },

  explain(id: string): Promise<Explanation> {
    const f = findings.find((x) => x.finding_id === id);
    if (!f) return Promise.reject(new MockError(404, "Finding not found."));
    const cached = explanations.get(id);
    if (cached) return delay({ ...cached, cached: true });
    const rule = ruleById.get(f.rule_id)!;
    const result: Explanation = {
      explanation: `${rule.description} SentinelStack found this on ${f.resource_arn}. (Demo mode: this text is a placeholder for the Bedrock response.)`,
      impact: `Severity ${f.severity}. Left unfixed, this weakens the account's security posture and lowers the score by ${WEIGHT[f.severity]} points.`,
      cli_fix: `# Review before running — demo placeholder for ${f.rule_id}\naws ${f.service} help`,
      cloudformation_fix: `# Demo placeholder for ${f.rule_id}\nResources:\n  # ...apply the secure setting to the resource here`,
      model: "demo",
      generated_at: new Date().toISOString(),
      cached: false,
    };
    explanations.set(id, result);
    return delay(result, 1200);
  },

  listRules: () => delay(RULES),

  listAudit: (cursor?: string | null) => delay(paginate(audit, cursor, 20)),

  getSettings: () => delay(settings),

  putSettings(next: Settings): Promise<Settings> {
    settings = next;
    audit_("settings.update", "org", { scan_interval_hours: next.scan_interval_hours, alert_emails: next.alert_emails.length });
    return delay(settings);
  },
};

export { MockError };
