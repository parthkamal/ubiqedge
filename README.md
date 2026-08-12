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
docker run -d --name ubiqedge-mysql -p 3307:3306 \
  -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=ubiqedge_water_billing \
  mysql:8
```

Mapped to host port `3307`, not `3306` — a local MySQL install already bound to `3306`
is a common conflict. If you use a different host port, set `DB_PORT` in `backend/.env`
(and `seed/.env`) to match; `backend/.env.example` defaults to `3306`.

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

Open http://localhost:5173 and log in — see **Test credentials** below.

## Test credentials

`seed.py` creates one admin and ten customers, all with fixed (not
randomly generated) passwords — unlike the ingestion API key, these are
hardcoded in `seed/seed.py` and reusable across re-runs, so they're safe
to put here directly rather than making you go dig through the script:

| Role     | Email                              | Password        |
| -------- | ----------------------------------- | ---------------- |
| Admin    | `priya.nair@rivergatewater.in`      | `Admin@12345`     |
| Customer | `anjali.deshpande@gmail.com`        | `Customer@12345`  |

Every other seeded customer (see `seed/seed.py` for the full list) shares
the same `Customer@12345` password.

## Endpoints

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api/v1
- **Swagger (backend API docs)**: http://localhost:3000/api/docs
- **Ingestion service**: http://localhost:3001/ingest/v1

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
  downsampling — an ETL/rollup pipeline would be the strategy for that.
- **No e2e/integration tests.** Unit tests mock Repository/DataSource,
  written per-module for the backend only; everything else was verified
  manually via curl/browser against a live MySQL instance throughout the
  build, not via an automated e2e suite.
- **Regenerating a cancelled invoice's period isn't instant, and the skip
  reason can be misread.** Cancelling an invoice doesn't free up its
  `(deviceId, billingPeriodStart, billingPeriodEnd)` slot — cancelled is a
  status, not a delete, by design. So retrying generation for that same
  period hits the DB's unique constraint and is skipped with `"already
  invoiced for this period"`, which is technically true but easy to
  misread as "nothing to do here," since the only invoice for that period
  is in fact cancelled. Nothing is lost: the opening checkpoint always
  anchors to the last **non-cancelled** invoice, so that consumption gets
  picked up automatically the next time generation runs for a
  later-ending period — no special "reissue" action needed or provided.
- **No proration across a pricing change mid-period.** Invoice generation
  looks up whichever pricing config is active *at generation time*
  (`effectiveTo IS NULL`), not whatever was active during the billing
  period itself. In the common case (generate promptly, config unchanged
  since) these are the same thing. But if the config changes mid-period —
  or a cancelled invoice causes the next one to span multiple months (see
  above) — the entire consumption is billed at whichever rate happens to
  be active when the job runs, not split across the change. Proration
  would need per-day consumption data this system doesn't have (only
  cumulative checkpoint readings), so it's left undone rather than
  half-built; `pricingConfigId` is still recorded on every invoice for
  audit purposes either way.

## Scaling Strategy

Infrastructure recommendation across three tiers, with the load/storage math behind each one. All three assume a single, closed-geography municipal deployment — multi-region is out of scope.

### Small scale — 50 meters

A single stateless app instance + a single MySQL node is enough. Run 2 app instances active-active for HA; the DB itself is the only real single point of failure at this tier, and that's an acceptable tradeoff given the load.

**Ingestion (write)**
- Cadence: worst case 1 reading/min/meter, 5 params/reading (upper bound) → 5 rows per request.
- Requests: ~1 req/s average (`50 meters / 60s`); a burst of all 50 meters landing in the same second (~50 req/s) is tolerated with brief queueing — nothing is dropped.
- Resulting writes: ~5 rows/s — trivial for MySQL and a single ingestion instance.
- No write-concurrency handling is needed beyond the database's own unique constraints (see Invoice generation, below).

**Reads (backend)**
- ~50 requests/day average (50 users, roughly one check-in each); ~1 req/s worst case — comfortably handled by one MySQL node and one backend instance.

**Invoice generation** — 1 transaction × 50 rows, once a month. Already idempotent by design: `openingCheckpointId` anchors to the previous invoice's `closingCheckpointId`, so a re-run never reprocesses already-billed readings, and a unique constraint on `(deviceId, billingPeriodStart, billingPeriodEnd)` prevents two admins from generating the same period twice.

**Storage** — `5 rows/s × 50 bytes/row × 5 years ≈ 40GB`, trivial for a single MySQL node.

### Medium scale — 300 meters

Same shape as the small tier, with two additions: a read replica, and partitioning set up ahead of need rather than retrofitted later.

**Ingestion (write)**
- Cadence and per-row size are unchanged from the small tier.
- Requests: ~5 req/s average (`300/60`); worst-case burst ~300 req/s — still tolerable.
- Resulting writes: ~25 rows/s — trivial for a single MySQL primary.

**Reads (backend)**
- Raw read volume is still low (well under 1 req/s sustained), so the read replica isn't there for query volume — it's there to isolate heavier queries (a month of readings scanned per meter during invoice generation, long-range consumption charts) from the primary's write path.

**Invoice generation** — 1 transaction × 300 rows, once a month. Same idempotent mechanism as the small tier; nothing new is needed at this volume.

**Storage** — `25 rows/s × 50 bytes/row × 5 years ≈ 197GB`. Still fits comfortably on one instance, but large enough to be worth doing three things from day one rather than after the fact:
- Monthly partitioning on `device_telemetry`.
- A scheduled job that prunes partitions older than ~6 months to cold storage, once every device's checkpoints are confirmed present.
- Moving that older data into a data warehouse for historical analytics.

**Recommended infrastructure** — 2 stateless app instances behind a load balancer (active-active) + 1 MySQL primary (SSD, ~250GB provisioned) + 1 read replica for reporting/invoice/chart queries.

### Large scale — 30,000 meters

The tier where a single app/DB pair stops being enough. Horizontal app scaling, partitioning, and pre-aggregated rollups are required from the outset, not added later.

**Ingestion (write)**
- Requests: ~500 req/s average (`30,000/60`). For capacity planning, a ~3x safety margin over the average (~1,500 req/s) is a more realistic worst case than assuming every device clock-aligns to the same second.
- Resulting writes: ~2,500 rows/s average, ~7,500 rows/s at the planning margin — more than a single ingestion instance should carry alone.
- This is handled by running several stateless ingestion instances behind a load balancer — the service already has no shared runtime state, so this is purely an operational change, not a code change — with each instance batching its writes into multi-row `INSERT`s to reduce round-trips to the database.

**Reads (backend)**
- ~30,000 requests/day, roughly 20 requests/min sustained assuming uniform distribution — still not the bottleneck. The real cost is long-range analytics/chart queries scanning years of raw data; those are routed to a read replica and served from rollups (see Storage).

**Invoice generation** — 1 transaction × 30,000 rows, once a month. The idempotency mechanism is unchanged from the smaller tiers; the concern at this volume shifts from correctness to run time, so generation becomes a batched/paginated job rather than a single all-rows transaction.

**Storage** — this is the tier where the database, not the application, becomes the bottleneck. Scaling the ingestion service horizontally solves the app-tier limit, but every instance still writes to the same MySQL primary, since InnoDB is single-writer — adding app replicas doesn't change that.
- Raw volume: `2,500 rows/s × 50 bytes/row × 5 years ≈ 19.7TB` — left unmanaged, this is the number that forces a real strategy.
- Write capacity: 2,500–7,500 rows/s of small indexed inserts is within reach of a single, well-tuned InnoDB primary (NVMe storage, sized buffer pool) once writes are batched. Sharding the write path (for example, by `orgId`) is the fallback if that's measured to be insufficient — not the starting design.
- Monthly partitioning on `device_telemetry` from day one, with partitions older than ~6–12 months archived to cheaper object storage and detached from the live table.
- An hourly/daily rollup table serves chart and report queries, so the archived raw data is rarely read once it's written.

**Recommended infrastructure** — 4–8+ stateless app instances behind a load balancer/autoscaler + 1 MySQL primary (high core count, high RAM, NVMe, tuned) + 1–2 read replicas for reporting + a scheduled ETL job for rollups and archival. A dedicated time-series database (e.g. TimescaleDB or ClickHouse) would be the more scalable long-term answer here; it's called out as a future improvement rather than implemented, since introducing a second database technology is outside the scope of this exercise.

