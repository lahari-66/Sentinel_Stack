"""Rule registry: every posture rule registers itself with the @rule decorator."""

from __future__ import annotations

import importlib
import pkgutil
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Any

SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW")
GROUPS = ("s3", "iam", "ec2", "ebs", "cloudtrail", "kms", "lambda")


@dataclass(frozen=True)
class Finding:
    rule_id: str
    resource_arn: str
    evidence: dict[str, Any]


@dataclass(frozen=True)
class Rule:
    id: str
    title: str
    severity: str
    group: str
    description: str
    remediation: str
    check: Callable[..., Iterable[Finding]]


_REGISTRY: dict[str, Rule] = {}


def rule(*, id: str, title: str, severity: str, group: str, description: str, remediation: str):
    if severity not in SEVERITIES:
        raise ValueError(f"{id}: unknown severity {severity}")
    if group not in GROUPS:
        raise ValueError(f"{id}: unknown group {group}")

    def decorator(fn: Callable[..., Iterable[Finding]]):
        if id in _REGISTRY:
            raise ValueError(f"duplicate rule id {id}")
        _REGISTRY[id] = Rule(id, title, severity, group, description, remediation, fn)
        return fn

    return decorator


def _load_all() -> None:
    import services.rules as pkg

    for mod in pkgutil.iter_modules(pkg.__path__):
        if mod.name != "registry":
            importlib.import_module(f"services.rules.{mod.name}")


def all_rules() -> list[Rule]:
    _load_all()
    return sorted(_REGISTRY.values(), key=lambda r: r.id)


def get_rule(rule_id: str) -> Rule:
    _load_all()
    return _REGISTRY[rule_id]


def rules_for_group(group: str) -> list[Rule]:
    return [r for r in all_rules() if r.group == group]
