from __future__ import annotations

from services.rules._s3_common import bucket_arn, buckets
from services.rules.registry import Finding, rule


@rule(
    id="S3-003",
    title="S3 bucket versioning is off",
    severity="LOW",
    group="s3",
    description="Versioning is not enabled, so overwritten or deleted objects cannot be recovered.",
    remediation="Enable versioning with put-bucket-versioning Status=Enabled.",
)
def check(ctx):
    for name, s3 in buckets(ctx):
        status = s3.get_bucket_versioning(Bucket=name).get("Status", "NeverEnabled")
        if status != "Enabled":
            yield Finding("S3-003", bucket_arn(name), {"bucket": name, "versioning_status": status})
