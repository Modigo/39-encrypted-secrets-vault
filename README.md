# Encrypted Secrets Vault

**Stack:** React 18 + Vite frontend, Python FastAPI backend, PostgreSQL 16 database, HTTP polling every 5 seconds for secret metadata and audit events.

## Run locally

Requires Docker Desktop, Python 3.10+, and Node.js 20+.

1. Start PostgreSQL with `docker compose up -d` from the project folder. The Compose service keeps data in the `vault_pgdata` volume; do not run `docker compose down -v` if you need to preserve it.
2. In PowerShell, create and activate the virtual environment, then install the Python dependencies:

	```powershell
	py -m venv .venv
	.\.venv\Scripts\Activate.ps1
	python -m pip install -r requirements.txt
	```

3. Create `.env` from the example only if it does not already exist, then edit it with your PostgreSQL connection. In PowerShell, run `if (-not (Test-Path .env)) { Copy-Item .env.example .env }`. Set an existing stable 32-byte hex master key. **For an existing vault, preserve its current `VAULT_MASTER_KEY` exactly; do not replace or regenerate it.** The sample `DATABASE_URL` matches `docker-compose.yml`. Keep `.env` private and do not commit it.
4. Start the API from the project folder. `backend.main` loads `.env` automatically:

	```powershell
	python -m uvicorn backend.main:app --reload
	```

	API docs: <http://localhost:8000/docs>
5. In a second PowerShell window, install and run the frontend:

	```powershell
	cd frontend
	npm install
	npm run dev
	```

	Open <http://localhost:5173>. The frontend defaults to `http://localhost:8000`; for a different API origin, set `VITE_API_URL` in `frontend/.env.local` before starting Vite. Set `FRONTEND_ORIGIN` in the root `.env` to the frontend origin if it differs from `http://localhost:5173`.

For production, use a managed PostgreSQL database, HTTPS, secure secret storage for `VAULT_MASTER_KEY`, and configure `FRONTEND_ORIGIN` and `VITE_API_URL` to deployed origins. The API creates tables at startup for the MVP; use Alembic migrations for a production system.

## API

- `POST /api/register` — register a username; the server generates and returns a one-time bearer token. Save that returned token; a token invented by the user is not valid.
- `GET /api/me` — verify token
- `GET /api/secrets`, `POST /api/secrets` — list/create
- `GET /api/secrets/{id}` — reveal authorized value
- `PUT /api/secrets/{id}/rotate` — rotate
- `POST /api/secrets/{id}/grants` — grant read/write
- `DELETE /api/secrets/{id}/grants/{username}` — revoke
- `DELETE /api/secrets/{id}` — delete
- `GET /api/audit` — audit events
- `GET /api/health` — health

Authenticated requests use `Authorization: Bearer TOKEN`. To sign in, create an account and save the token returned by registration, then paste that exact issued token into the sign-in field. The username is not a login credential. The database stores only a SHA-256 hash of each token; the raw token is shown once and cannot be recovered. Existing accounts and their tokens remain unchanged. The React dashboard polls list/audit every 5 seconds, not decrypted secret values.

## Demo walkthrough

Register Alice, save token, create a dummy `PAYMENT_API_KEY`. Register Bob in another browser, save token. Alice grants Bob `read` access. Bob can reveal but cannot rotate (403). Alice rotates the value (version increments), then revokes Bob. Show Bob's denied read and audit activity.

## Security notes

AES-256-GCM encrypts values with a random 12-byte nonce and authenticated secret ID/version. The database stores ciphertext and SHA-256 bearer token hashes, not plaintext secrets or raw bearer tokens. The UI only reveals on demand; avoid recording screen while revealing. PostgreSQL constraints enforce ownership/name uniqueness and grant uniqueness. This is an **educational MVP**, not a production-audited secrets manager. Before storing real credentials add expiring/revocable sessions, rate limiting, secret management/KMS, HTTPS-only deployment, structured migration and backup strategy, audit integrity, incident monitoring, and concurrency tests. Treat copied tokens and revealed values as sensitive.
