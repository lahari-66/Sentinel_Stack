from services.rules.registry import GROUPS, SEVERITIES, all_rules


def test_rules_have_valid_metadata():
    rules = all_rules()
    assert rules, "no rules registered"
    for r in rules:
        assert r.severity in SEVERITIES
        assert r.group in GROUPS
        assert r.title and r.description and r.remediation


def test_week1_rules_registered():
    ids = {r.id for r in all_rules()}
    assert {"S3-001", "S3-002", "S3-003", "IAM-001", "IAM-002"} <= ids
