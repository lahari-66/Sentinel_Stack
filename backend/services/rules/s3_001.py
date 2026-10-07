from __future__ import annotations

import json

from botocore.exceptions import ClientError

from services.rules._s3_common import bucket_arn, buckets, error_code
from services.rules.registry import Finding, rule

PUBLIC_GRANTEES = {
    "http://acs.amazonaws.com/groups/global/AllUsers",
    "http://acs.amazonaws.com/groups/global/AuthenticatedUsers",
}
BPA_KEYS = ("BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")


def _account_bpa(ctx) -> dict:
    try:
        cfg = ctx.client("s3control").get_public_access_block(AccountId=ctx.account_id)
        return cfg["PublicAccessBlockConfiguration"]
    except ClientError as exc:
        if error_code(exc) == "NoSuchPublicAccessBlockConfiguration":
            return {}
        raise


def _bucket_bpa(s3, name: str) -> dict:
    try:
        return s3.get_public_access_block(Bucket=name)["PublicAccessBlockConfiguration"]
    except ClientError as exc:
        if error_code(exc) == "NoSuchPublicAccessBlockConfiguration":
            return {}
        raise


def _public_acl_grants(s3, name: str) -> list[dict]:
    grants = s3.get_bucket_acl(Bucket=name).get("Grants", [])
    return [
        {"grantee": g["Grantee"].get("URI"), "permission": g["Permission"]}
        for g in grants
        if g.get("Grantee", {}).get("URI") in PUBLIC_GRANTEES
    ]


def _is_wildcard_principal(principal) -> bool:
    if principal == "*":
        return True
    if isinstance(principal, dict):
        aws = principal.get("AWS")
        return aws == "*" or (isinstance(aws, list) and "*" in aws)
    return False


def _public_policy_statements(s3, name: str) -> list[dict]:
    try:
        policy = json.loads(s3.get_bucket_policy(Bucket=name)["Policy"])
    except ClientError as exc:
        if error_code(exc) == "NoSuchBucketPolicy":
            return []
        raise
    stmts = policy.get("Statement", [])
    if isinstance(stmts, dict):
        stmts = [stmts]
    return [
        {"sid": s.get("Sid"), "action": s.get("Action")}
        for s in stmts
        if s.get("Effect") == "Allow" and _is_wildcard_principal(s.get("Principal")) and not s.get("Condition")
    ]


@rule(
    id="S3-001",
    title="S3 bucket is effectively public",
    severity="CRITICAL",
    group="s3",
    description="The bucket grants access to everyone through its ACL or bucket policy, "
    "and Block Public Access (account or bucket level) does not neutralise it.",
    remediation="Enable S3 Block Public Access on the bucket and account; remove public ACL grants "
    "and Principal '*' statements from the bucket policy.",
)
def check(ctx):
    account = _account_bpa(ctx)
    for name, s3 in buckets(ctx):
        bucket = _bucket_bpa(s3, name)
        effective = {k: bool(account.get(k)) or bool(bucket.get(k)) for k in BPA_KEYS}
        acl = [] if effective["IgnorePublicAcls"] else _public_acl_grants(s3, name)
        policy = [] if effective["RestrictPublicBuckets"] else _public_policy_statements(s3, name)
        if acl or policy:
            yield Finding(
                "S3-001",
                bucket_arn(name),
                {
                    "bucket": name,
                    "public_acl_grants": acl,
                    "public_policy_statements": policy,
                    "effective_block_public_access": effective,
                },
            )
