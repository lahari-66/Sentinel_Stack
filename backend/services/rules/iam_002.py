from __future__ import annotations

from botocore.exceptions import ClientError

from services.rules.registry import Finding, rule


def _has_console_password(iam, user: str) -> bool:
    try:
        iam.get_login_profile(UserName=user)
        return True
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchEntity":
            return False
        raise


@rule(
    id="IAM-002",
    title="Console user without MFA",
    severity="HIGH",
    group="iam",
    description="An IAM user can sign in to the console with a password but has no MFA device.",
    remediation="Assign a virtual or hardware MFA device to the user, or remove the login profile.",
)
def check(ctx):
    iam = ctx.client("iam")
    for page in iam.get_paginator("list_users").paginate():
        for user in page["Users"]:
            name = user["UserName"]
            if not _has_console_password(iam, name):
                continue
            if not iam.list_mfa_devices(UserName=name)["MFADevices"]:
                yield Finding("IAM-002", user["Arn"], {"user": name, "console_access": True, "mfa_devices": 0})
