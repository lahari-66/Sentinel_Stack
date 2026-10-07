"""Run every rule in a group with per-rule error isolation."""

from __future__ import annotations

from dataclasses import asdict

from scanner.context import ScanContext
from services.rules.registry import rules_for_group


def run_group(ctx: ScanContext, group: str) -> dict:
    findings, errors = [], []
    for r in rules_for_group(group):
        try:
            findings.extend(asdict(f) for f in r.check(ctx))
        except Exception as exc:  # one broken rule must not sink the group
            errors.append({"rule_id": r.id, "error": f"{type(exc).__name__}: {exc}"})
    return {"group": group, "findings": findings, "rule_errors": errors}
