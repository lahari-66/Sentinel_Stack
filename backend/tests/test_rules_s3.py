import json

from tests.conftest import run

PUBLIC_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Public",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::open/*",
        }
    ],
}


def _hardened(s3, name):
    s3.create_bucket(Bucket=name)
    s3.put_public_access_block(
        Bucket=name,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    s3.put_bucket_encryption(
        Bucket=name,
        ServerSideEncryptionConfiguration={
            "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
        },
    )
    s3.put_bucket_versioning(Bucket=name, VersioningConfiguration={"Status": "Enabled"})


# S3-001 -----------------------------------------------------------------------


def test_s3_001_public_policy_detected(aws, ctx):
    s3 = aws.client("s3")
    s3.create_bucket(Bucket="open")
    s3.put_bucket_policy(Bucket="open", Policy=json.dumps(PUBLIC_POLICY))
    findings = run("S3-001", ctx)
    assert [f.resource_arn for f in findings] == ["arn:aws:s3:::open"]
    assert findings[0].evidence["public_policy_statements"][0]["sid"] == "Public"


def test_s3_001_public_acl_detected(aws, ctx):
    s3 = aws.client("s3")
    s3.create_bucket(Bucket="acl-open", ACL="public-read")
    findings = run("S3-001", ctx)
    assert len(findings) == 1
    assert findings[0].evidence["public_acl_grants"]


def test_s3_001_private_bucket_clean(aws, ctx):
    _hardened(aws.client("s3"), "private")
    assert run("S3-001", ctx) == []


def test_s3_001_bucket_bpa_neutralises_public_policy(aws, ctx):
    s3 = aws.client("s3")
    s3.create_bucket(Bucket="open")
    s3.put_bucket_policy(Bucket="open", Policy=json.dumps(PUBLIC_POLICY))
    s3.put_public_access_block(
        Bucket="open",
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    assert run("S3-001", ctx) == []


def test_s3_001_account_bpa_neutralises_public_acl(aws, ctx):
    s3 = aws.client("s3")
    s3.create_bucket(Bucket="acl-open", ACL="public-read")
    aws.client("s3control").put_public_access_block(
        AccountId=ctx.account_id,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    assert run("S3-001", ctx) == []


# S3-002 -----------------------------------------------------------------------


def test_s3_002_no_default_encryption_detected(aws, ctx):
    s3 = aws.client("s3")
    s3.create_bucket(Bucket="plain")
    s3.delete_bucket_encryption(Bucket="plain")
    findings = run("S3-002", ctx)
    assert [f.resource_arn for f in findings] == ["arn:aws:s3:::plain"]


def test_s3_002_encrypted_bucket_clean(aws, ctx):
    _hardened(aws.client("s3"), "enc")
    assert run("S3-002", ctx) == []


# S3-003 -----------------------------------------------------------------------


def test_s3_003_versioning_off_detected(aws, ctx):
    aws.client("s3").create_bucket(Bucket="nover")
    findings = run("S3-003", ctx)
    assert findings[0].evidence["versioning_status"] == "NeverEnabled"


def test_s3_003_suspended_versioning_detected(aws, ctx):
    s3 = aws.client("s3")
    s3.create_bucket(Bucket="susp")
    s3.put_bucket_versioning(Bucket="susp", VersioningConfiguration={"Status": "Suspended"})
    assert run("S3-003", ctx)[0].evidence["versioning_status"] == "Suspended"


def test_s3_003_versioned_bucket_clean(aws, ctx):
    _hardened(aws.client("s3"), "ver")
    assert run("S3-003", ctx) == []
