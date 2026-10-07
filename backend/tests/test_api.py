from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_me_requires_auth(monkeypatch):
    monkeypatch.delenv("SENTINEL_LOCAL_DEV", raising=False)
    assert client.get("/me").status_code == 401


def test_me_local_dev(monkeypatch):
    monkeypatch.setenv("SENTINEL_LOCAL_DEV", "1")
    body = client.get("/me").json()
    assert body["org_id"] == "local" and body["role"] == "admin"


def test_me_from_jwt_claims():
    from app.main import handler

    event = {
        "version": "2.0",
        "routeKey": "GET /me",
        "rawPath": "/me",
        "rawQueryString": "",
        "headers": {"host": "x"},
        "requestContext": {
            "http": {"method": "GET", "path": "/me", "sourceIp": "1.1.1.1", "protocol": "HTTP/1.1"},
            "authorizer": {
                "jwt": {
                    "claims": {"sub": "abc", "email": "a@b.c", "custom:org_id": "org1", "cognito:groups": "[viewer]"}
                }
            },
            "stage": "$default",
            "requestId": "r",
            "accountId": "1",
            "apiId": "a",
            "domainName": "x",
            "domainPrefix": "x",
            "time": "",
            "timeEpoch": 0,
        },
        "isBase64Encoded": False,
    }
    import json

    resp = handler(event, None)
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"]) == {"sub": "abc", "email": "a@b.c", "org_id": "org1", "role": "viewer"}
