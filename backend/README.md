# backend

- `app/` — FastAPI routers, models, repositories, auth (Track B)
- `scanner/` — register, assume, rule_group, aggregate, alert Lambdas (Track A, alert: Track B)
- `services/rules/` — rule registry + one file per rule (Track A)
- `tests/` — one moto test per rule + API tests
