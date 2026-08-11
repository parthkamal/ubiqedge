# ubiqedge

On-premise IoT water billing system. See `ubiqedge_fr` (requirements) and the
`ubiqedge_tech_*` docs (data model, API design, implementation spec) for the
full design writeup.

## Documentation

Structured, service-level documentation (functional requirements, technical
specs, API reference, DB tables, implementation detail) lives alongside each
service:

- [`backend/docs/main.md`](backend/docs/main.md) — the core admin/customer
  API (auth, users, accounts, devices, pricing, invoices, payments)
- [`ingestion-service/docs/main.md`](ingestion-service/docs/main.md) — the
  telemetry write path

## Prerequisites

- Node.js 18+
- Python 3.9+
- MySQL 8 (a throwaway Docker container works fine for local dev)

## Run order

Start these in order — each step depends on the one before it.

### 1. MySQL

Any MySQL 8 instance works. Example throwaway container:

```
docker run -d --name ubiqedge-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=ubiqedge_water_billing \
  mysql:8
```

### 2. backend

```
cd backend
npm install
cp .env.example .env        # edit DB_* if not using the defaults above
npm run migration:run       # creates all tables
npm run start:dev           # listens on :3000
```

### 3. seed

Creates the demo org, roles, admin user, customers, accounts, devices, and
pricing config. Safe to re-run (skips anything that already exists).

```
cd seed
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env        # edit DB_* if not using the defaults above
.venv/bin/python seed.py
```

Prints the admin login and an ingestion API key — save the API key, it's
only shown once (needed by the simulators in step 5).

### 4. ingestion-service

```
cd ingestion-service
npm install
cp .env.example .env        # edit DB_* if not using the defaults above
npm run start:dev           # listens on :3001
```

### 5. meter-simulator / tank-simulator (optional)

Generates ongoing telemetry for the seeded devices so there's data to look
at. Run either or both, each in its own terminal.

```
cd meter-simulator           # or tank-simulator
npm install
cp .env.example .env
# set API_KEY to the value seed.py printed in step 3
npm start
```

### 6. frontend

```
cd frontend
npm install
cp .env.example .env        # points at the backend from step 2 by default
npm run dev                 # listens on :5173
```

Open http://localhost:5173 and log in with the admin credentials `seed.py`
printed in step 3.

## Known limitations

Deliberate scope decisions, not oversights — full rationale is in
`ubiqedge_tech_implementation_spec` §10.

- **No refresh-token flow.** Access-token-only JWT; session length is a
  fixed tradeoff (`JWT_EXPIRES_IN`).
- **No forgot-password flow.** A real implementation needs to prove
  identity without the password, which means emailing a reset link — this
  stack has no email-sending capability at all. Judged lower priority than
  the required FR scope and left out entirely rather than half-built.
  Admin can still create/manage all users, so there's no lockout dead end,
  just no self-service reset.
- **Payment gateway is mocked.** `POST /invoices/:id/pay` returns a
  placeholder `checkoutUrl` — there's no real hosted checkout page.
  Completion only happens via the signature-verified webhook
  (`POST /payments/v1/webhook/:provider`), which nothing in the browser can
  trigger by design (it needs the shared HMAC secret). Trigger it manually
  (e.g. via curl) to exercise the PAID path end-to-end.
- **Telemetry chart caps at 500 points per request** (the backend's own
  max `limit`). Fine for this demo's data volumes; a production deployment
  with months of 5-minute-cadence readings would need server-side
  downsampling.
- **No e2e/integration tests.** Unit tests mock Repository/DataSource;
  everything else was verified manually via curl/browser against a live
  MySQL instance throughout the build, not via an automated e2e suite.
