# Lockbox — Encrypted Secrets Vault

**Stack:** React 18 + Vite frontend, Python FastAPI backend, PostgreSQL 16 database, HTTP polling every 5 seconds for secret metadata and audit events.

## Run locally

Requires Docker, Python 3.10+, Node 20+.

1. `docker compose up -d` (starts PostgreSQL)
2. `python -m venv .venv && source .venv/bin/activate` (Windows: `.venv\Scripts\activate`)
3. `pip install -r requirements.txt`
4. Copy `.env.example` to `.env`. Generate a stable key: `python -c "import secrets; print(secrets.token_hex(32))"`. Replace `VAULT_MASTER_KEY` with the output. **Keep the same key on every restart.**
5. Load backend environment variables: `set -a; source .env; set +a` (Windows PowerShell: set `DATABASE_URL`, `VAULT_MASTER_KEY`, `FRONTEND_ORIGIN` via `$env:NAME='value'`).
6. `uvicorn backend.main:app --reload` (API: http://localhost:8000/docs)
7. In another terminal: `cd frontend && npm install && npm run dev` (UI: http://localhost:5173)

For production, use a managed PostgreSQL database, HTTPS, secure secret storage for `VAULT_MASTER_KEY`, and configure `FRONTEND_ORIGIN` and `VITE_API_URL` to deployed origins. The API creates tables at startup for the MVP; use Alembic migrations for a production system.

## API

- `POST /api/register` — register username; returns one-time bearer token
- `GET /api/me` — verify token
- `GET /api/secrets`, `POST /api/secrets` — list/create
- `GET /api/secrets/{id}` — reveal authorized value
- `PUT /api/secrets/{id}/rotate` — rotate
- `POST /api/secrets/{id}/grants` — grant read/write
- `DELETE /api/secrets/{id}/grants/{username}` — revoke
- `DELETE /api/secrets/{id}` — delete
- `GET /api/audit` — audit events
- `GET /api/health` — health

Authenticated requests use `Authorization: Bearer TOKEN`. The React dashboard polls list/audit every 5 seconds, not decrypted secret values.

## Demo walkthrough

Register Alice, save token, create a dummy `PAYMENT_API_KEY`. Register Bob in another browser, save token. Alice grants Bob `read` access. Bob can reveal but cannot rotate (403). Alice rotates the value (version increments), then revokes Bob. Show Bob's denied read and audit activity.

## Security notes

AES-256-GCM encrypts values with a random 12-byte nonce and authenticated secret ID/version. The database stores ciphertext and SHA-256 bearer token hashes, not plaintext secrets or raw bearer tokens. The UI only reveals on demand; avoid recording screen while revealing. PostgreSQL constraints enforce ownership/name uniqueness and grant uniqueness. This is an **educational MVP**, not a production-audited secrets manager. Before storing real credentials add expiring/revocable sessions, rate limiting, secret management/KMS, HTTPS-only deployment, structured migration and backup strategy, audit integrity, incident monitoring, and concurrency tests. Treat copied tokens and revealed values as sensitive.
