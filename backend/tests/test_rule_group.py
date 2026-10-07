from scanner.rule_group import run_group
from services.rules import registry


def test_broken_rule_is_isolated(ctx, monkeypatch):
    ctx.client("s3").create_bucket(Bucket="nover")
    broken = registry.Rule("S3-999", "t", "LOW", "s3", "d", "r", lambda c: 1 / 0)
    monkeypatch.setitem(registry._REGISTRY, "S3-999", broken)

    result = run_group(ctx, "s3")

    assert result["rule_errors"] == [{"rule_id": "S3-999", "error": "ZeroDivisionError: division by zero"}]
    assert any(f["rule_id"] == "S3-003" for f in result["findings"])
