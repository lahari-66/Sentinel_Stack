"""Week-1 demo: run the rules from a laptop against the target account.

python -m scanner.local_scan --role-arn arn:aws:iam::111122223333:role/SentinelStackScannerRole \
    --external-id <id> --region us-east-1 [--profile sentinel]
"""

from __future__ import annotations

import argparse
import json

import boto3

from scanner.assume import assume_scanner_role
from scanner.context import ScanContext
from scanner.rule_group import run_group
from services.rules.registry import GROUPS


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--role-arn", required=True)
    p.add_argument("--external-id", required=True)
    p.add_argument("--region", default="us-east-1")
    p.add_argument("--profile")
    args = p.parse_args()

    session = assume_scanner_role(
        args.role_arn, args.external_id, base_session=boto3.Session(profile_name=args.profile)
    )
    ctx = ScanContext.from_session(session, args.region)
    results = [run_group(ctx, g) for g in GROUPS]
    findings = [f for r in results for f in r["findings"]]
    errors = [e for r in results for e in r["rule_errors"]]
    print(json.dumps({"findings": findings, "rule_errors": errors}, indent=2, default=str))
    print(f"\n{len(findings)} findings, {len(errors)} rule errors")


if __name__ == "__main__":
    main()
