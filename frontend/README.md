# SecretsVault frontend

React + Vite UI for the Encrypted Secrets Vault. Design source of truth: `mockups/`.

## Run

```bash
cd frontend
npm install
cp .env.example .env.local   # then edit if needed
npm run dev                  # http://localhost:5173
```

| Variable | Meaning |
|---|---|
| `VITE_API_URL` | Backend base URL, e.g. `http://localhost:8000` |
| `VITE_USE_MOCK` | `true` = in-memory mock API with the mockup data (no backend needed) |
| `VITE_DEMO_ACCOUNTS` | Written by `npm run seed:demo`; don't edit by hand |

### Demo accounts (real backend)

The backend has no passwords. Each user gets a bearer token once, at registration. To set up the demo users, start the backend (see the root README), then:

```bash
npm run seed:demo
```

This registers `mustapha`, `tekena`, `charity`, `standford` and `cd_demo`, creates the 8 mockup secrets with random dummy values, and adds grants. `cd_demo` has read access to `DATABASE_URL` and no access to `DATABASE_PASSWORD`, which drives the 403 demo. The tokens are written to `.env.local`.

> **The demo tokens are for a local seeded database only.** `.env.local` is gitignored. Never commit it, and never deploy a build made with it: Vite bundles `VITE_*` values into the JavaScript.

Running the seed again against the same database fails, because the backend won't reissue tokens. Reset the database (`docker compose down -v && docker compose up -d`, then restart the API) or run `npm run seed:demo -- --suffix _2`.

### Demo-day checklist

1. Start PostgreSQL and the API (root README). Check `http://localhost:8000/api/health` returns `{"status":"ok"}`.
2. In `frontend/`, run `npm run seed:demo` against a fresh database.
3. In `.env.local`, make sure `VITE_USE_MOCK=false` (the seed script warns if it isn't), then restart `npm run dev`.
4. Walk through the demo once:
   - Sign in with the **mustapha** tile, then open `DATABASE_PASSWORD` and click Reveal.
   - Switch "Acting as" to **cd_demo**. The access-denied screen should appear.
   - Still as **cd_demo**, rotate `DATABASE_URL` from the dashboard. You should get a 403.
   - Check that both denials show up in **Audit log**.
5. If the backend fails during the demo, set `VITE_USE_MOCK=true` and restart `npm run dev` to switch to the mock data.

### Mock mode

Set `VITE_USE_MOCK=true` to run without a backend. The demo tiles and the "Acting as" switcher use the five mockup users. CD gets a 403 on `DATABASE_PASSWORD`.

## Security notes

- The bearer token is kept in memory only, so reloading the page signs you out.
- Secret values are fetched only when you click Reveal. They're cleared on Hide, after 30 seconds, or when you leave the page. They're never polled, stored or logged.

See `BACKEND_REQUESTS.md` for the API gaps the UI currently works around.
