"""Identity from the API Gateway HTTP API JWT authorizer (Cognito). The gateway has already verified the token."""

from __future__ import annotations

import os

from fastapi import HTTPException, Request
from pydantic import BaseModel


class Principal(BaseModel):
    sub: str
    email: str | None
    org_id: str
    role: str  # "admin" | "viewer"


def _parse_groups(raw) -> list[str]:
    # HTTP API passes list claims as a string like "[admin viewer]"
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    return raw.strip("[]").replace(",", " ").split()


def _claims(request: Request) -> dict:
    event = request.scope.get("aws.event") or {}
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims")
    if claims:
        return claims
    if os.environ.get("SENTINEL_LOCAL_DEV") == "1":
        return {"sub": "local-dev", "email": "dev@localhost", "custom:org_id": "local", "cognito:groups": "[admin]"}
    raise HTTPException(status_code=401, detail="unauthenticated")


def current_principal(request: Request) -> Principal:
    claims = _claims(request)
    org_id = claims.get("custom:org_id")
    if not org_id:
        raise HTTPException(status_code=403, detail="user has no organisation")
    groups = _parse_groups(claims.get("cognito:groups"))
    return Principal(
        sub=claims["sub"], email=claims.get("email"), org_id=org_id, role="admin" if "admin" in groups else "viewer"
    )
