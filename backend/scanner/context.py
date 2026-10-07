"""ScanContext: what a rule receives — a boto3 session for the customer account plus client caching."""

from __future__ import annotations

from dataclasses import dataclass, field

import boto3
from botocore.config import Config

RETRY_CONFIG = Config(retries={"max_attempts": 8, "mode": "adaptive"})


@dataclass
class ScanContext:
    session: boto3.Session
    account_id: str
    region: str
    _clients: dict = field(default_factory=dict)

    def client(self, service: str, region: str | None = None):
        key = (service, region or self.region)
        if key not in self._clients:
            self._clients[key] = self.session.client(service, region_name=key[1], config=RETRY_CONFIG)
        return self._clients[key]

    @classmethod
    def from_session(cls, session: boto3.Session, region: str) -> ScanContext:
        account_id = session.client("sts", region_name=region).get_caller_identity()["Account"]
        return cls(session=session, account_id=account_id, region=region)
