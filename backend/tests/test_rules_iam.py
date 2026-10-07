from botocore.stub import Stubber

from scanner.context import ScanContext
from tests.conftest import run

# IAM-001 ----------------------------------------------------------------------


def _ctx_with_summary(aws, keys_present):
    iam = aws.client("iam")
    stub = Stubber(iam)
    stub.add_response("get_account_summary", {"SummaryMap": {"AccountAccessKeysPresent": keys_present}})
    stub.activate()
    c = ScanContext(session=aws, account_id="123456789012", region="us-east-1")
    c._clients[("iam", "us-east-1")] = iam
    return c


def test_iam_001_root_keys_detected(aws):
    findings = run("IAM-001", _ctx_with_summary(aws, 1))
    assert findings[0].resource_arn == "arn:aws:iam::123456789012:root"


def test_iam_001_no_root_keys_clean(aws):
    assert run("IAM-001", _ctx_with_summary(aws, 0)) == []


# IAM-002 ----------------------------------------------------------------------


def test_iam_002_console_user_without_mfa_detected(aws, ctx):
    iam = aws.client("iam")
    iam.create_user(UserName="alice")
    iam.create_login_profile(UserName="alice", Password="Str0ng!Passw0rd")
    findings = run("IAM-002", ctx)
    assert [f.evidence["user"] for f in findings] == ["alice"]


def test_iam_002_console_user_with_mfa_clean(aws, ctx):
    iam = aws.client("iam")
    iam.create_user(UserName="bob")
    iam.create_login_profile(UserName="bob", Password="Str0ng!Passw0rd")
    serial = iam.create_virtual_mfa_device(VirtualMFADeviceName="bob")["VirtualMFADevice"]["SerialNumber"]
    iam.enable_mfa_device(
        UserName="bob", SerialNumber=serial, AuthenticationCode1="123456", AuthenticationCode2="654321"
    )
    assert run("IAM-002", ctx) == []


def test_iam_002_programmatic_only_user_clean(aws, ctx):
    aws.client("iam").create_user(UserName="ci-bot")
    assert run("IAM-002", ctx) == []
