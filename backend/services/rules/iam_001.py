from __future__ import annotations

from services.rules.registry import Finding, rule


@rule(
    id="IAM-001",
    title="Root user has access keys",
    severity="CRITICAL",
    group="iam",
    description="The account root user has one or more access keys. Root keys cannot be scoped down.",
    remediation="Sign in as root, delete the access keys under Security credentials, and use IAM roles instead.",
)
def check(ctx):
    summary = ctx.client("iam").get_account_summary()["SummaryMap"]
    present = summary.get("AccountAccessKeysPresent", 0)
    if present:
        yield Finding("IAM-001", f"arn:aws:iam::{ctx.account_id}:root", {"account_access_keys_present": present})
