import os

import boto3
import pytest
from moto import mock_aws

os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("AWS_SESSION_TOKEN", "testing")
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

from scanner.context import ScanContext  # noqa: E402


@pytest.fixture
def aws():
    with mock_aws():
        yield boto3.Session(region_name="us-east-1")


@pytest.fixture
def ctx(aws):
    return ScanContext.from_session(aws, "us-east-1")


def run(rule_id, ctx):
    from services.rules.registry import get_rule

    return list(get_rule(rule_id).check(ctx))
