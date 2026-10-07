from __future__ import annotations

from botocore.exceptions import ClientError

from services.rules._s3_common import bucket_arn, buckets, error_code
from services.rules.registry import Finding, rule


@rule(
    id="S3-002",
    title="S3 bucket default encryption is off",
    severity="MEDIUM",
    group="s3",
    description="The bucket has no default server-side encryption configuration.",
    remediation="Set default encryption to SSE-S3 or SSE-KMS with put-bucket-encryption.",
)
def check(ctx):
    for name, s3 in buckets(ctx):
        try:
            s3.get_bucket_encryption(Bucket=name)
        except ClientError as exc:
            if error_code(exc) != "ServerSideEncryptionConfigurationNotFoundError":
                raise
            yield Finding("S3-002", bucket_arn(name), {"bucket": name, "default_encryption": None})
