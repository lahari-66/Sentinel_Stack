// Shapes returned by the SentinelStack API. They follow docs/data-model.md and the API surface in
// section 2.6 of the plan; docs/openapi.yaml (Track B) is the source of truth once it lands.

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Service = "s3" | "iam" | "ec2" | "ebs" | "cloudtrail" | "kms" | "lambda";
export type FindingStatus = "open" | "resolved" | "suppressed";
export type AccountStatus = "pending" | "connected" | "disconnected";
export type ScanStatus = "running" | "succeeded" | "failed";
export type Role = "viewer" | "admin";

export const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
export const SERVICES: Service[] = ["s3", "iam", "ec2", "ebs", "cloudtrail", "kms", "lambda"];
export const FINDING_STATUSES: FindingStatus[] = ["open", "resolved", "suppressed"];

export interface Me {
  sub: string;
  email: string;
  org_id: string;
  role: Role;
}

export interface Account {
  account_id: string; // 12-digit AWS account ID
  role_arn: string | null;
  region: string;
  status: AccountStatus;
  last_scan_id: string | null;
  last_score: number | null;
  last_scan_at: string | null;
  created_at: string;
}

/** POST /accounts response: the External ID is shown once so the user can deploy the role. */
export interface CreateAccountResponse {
  account: Account;
  external_id: string;
  quick_create_url: string;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface Scan {
  scan_id: string;
  account_id: string;
  status: ScanStatus;
  trigger: "manual" | "schedule";
  started_at: string;
  finished_at: string | null;
  score: number | null;
  counts: SeverityCounts;
  new: number;
  resolved: number;
  rule_errors: string[];
}

export interface Suppression {
  by: string;
  reason: string;
  at: string;
}

export interface Finding {
  finding_id: string; // FIND#<ruleId>#<sha1(resourceArn)>, URL-encoded by the client
  account_id: string;
  rule_id: string;
  title: string;
  service: Service;
  severity: Severity;
  resource_arn: string;
  evidence: Record<string, unknown>;
  status: FindingStatus;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
  suppressed: Suppression | null;
}

export interface Rule {
  rule_id: string;
  title: string;
  severity: Severity;
  service: Service;
  description: string;
}

export interface Explanation {
  explanation: string;
  impact: string;
  cli_fix: string;
  cloudformation_fix: string;
  model: string;
  generated_at: string;
  cached: boolean;
}

export interface AuditEntry {
  at: string;
  user: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
}

export interface Settings {
  name: string;
  alert_emails: string[];
  scan_interval_hours: 6 | 12 | 24;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface FindingFilters {
  account_id?: string;
  severity?: Severity;
  service?: Service;
  status?: FindingStatus;
  rule_id?: string;
  q?: string; // resource search
}
