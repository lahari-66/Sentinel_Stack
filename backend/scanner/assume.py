"""Assume the customer's SentinelStackScannerRole with its External ID."""

from __future__ import annotations

import boto3

SESSION_SECONDS = 3600


def assume_scanner_role(
    role_arn: str, external_id: str, session_name: str = "sentinelstack-scan", base_session: boto3.Session | None = None
) -> boto3.Session:
    sts = (base_session or boto3.Session()).client("sts")
    creds = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName=session_name,
        ExternalId=external_id,
        DurationSeconds=SESSION_SECONDS,
    )["Credentials"]
    return boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
    )
