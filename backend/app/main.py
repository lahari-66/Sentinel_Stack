from __future__ import annotations

from typing import Annotated

from fastapi import Depends, FastAPI
from mangum import Mangum

from app.auth import Principal, current_principal

app = FastAPI(title="SentinelStack API", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/me", response_model=Principal)
def me(principal: Annotated[Principal, Depends(current_principal)]) -> Principal:
    return principal


handler = Mangum(app, lifespan="off")
