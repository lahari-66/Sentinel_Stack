"""Shared S3 helpers: list buckets and get a client in each bucket's own region."""

from __future__ import annotations

from botocore.exceptions import ClientError


def bucket_arn(name: str) -> str:
    return f"arn:aws:s3:::{name}"


def buckets(ctx):
    """Yield (name, regional_client) for every bucket in the account."""
    s3 = ctx.client("s3")
    for b in s3.list_buckets().get("Buckets", []):
        loc = s3.get_bucket_location(Bucket=b["Name"]).get("LocationConstraint") or "us-east-1"
        yield b["Name"], ctx.client("s3", loc)


def error_code(exc: ClientError) -> str:
    return exc.response.get("Error", {}).get("Code", "")
