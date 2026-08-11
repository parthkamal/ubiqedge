# Technical Specifications

## Module Structure

```
ingestion-service/src/
├── main.ts                          Bootstrap (global ValidationPipe, global exception filter)
├── app.module.ts                    Root module — wires DatabaseModule + IngestModule
├── config/
│   └── database.config.ts           mysql2 pool config from env
├── database/
│   ├── database.module.ts           Global module providing the DATABASE_POOL token
│   └── database.constants.ts        DATABASE_POOL injection token
├── ingest/
│   ├── ingest.module.ts
│   ├── ingest.controller.ts         POST /ingest/v1/:orgCode/:deviceType/:serialNo
│   ├── ingest.service.ts            Resolution, validation, idempotent insert
│   ├── dto/
│   │   ├── ingest-telemetry.dto.ts  Request body (deviceTimestamp + readings[])
│   │   └── ingest-reading.dto.ts    One reading (paramKey + value)
│   ├── param-key.enum.ts            TOTAL | FLOW | LEVEL
│   └── device-type.enum.ts          METER | TANK
└── common/
    ├── guards/
    │   └── api-key.guard.ts         X-Api-Key → organization match
    └── filters/
        └── all-exceptions.filter.ts Uniform error JSON shape
```

## Why This Is a Separate Service

`../../ubiqedge_tech_implementation_spec` §0/§0a lays out the rationale, reproduced here:

- **Different load shape.** `backend` serves bursty, human-driven admin/customer traffic. `ingestion-service` serves constant, machine-driven traffic at a fixed cadence (every device, every 5 minutes) — closer to a firehose than a CRUD API.
- **Independent scaling and failure isolation.** The two services can be scaled, deployed, and restarted independently. An ingestion-side incident (e.g. a device firmware bug flooding retries) does not degrade the admin/customer-facing API, and vice versa — a slow admin report query cannot back up telemetry writes.
- **No shared runtime state.** Both services read/write the same MySQL schema but do not call each other and share no in-process state, so they can be deployed on entirely separate hosts/containers without coordination.
- **Minimal surface, minimal dependencies.** This service has one route and no business logic beyond validate-and-write, so it deliberately skips the heavier machinery `backend` needs (TypeORM, JWT, RBAC guards) in favor of a raw `mysql2` pool and a single API-key check — less to fail, less to scale, less to reason about under load.

## Why Raw `mysql2`, Not TypeORM

`backend` owns the schema (all entity definitions and migrations live there). `ingestion-service` only ever performs one shape of write — an `INSERT ... ON DUPLICATE KEY` style idempotent insert into `device_telemetry` — plus a handful of read-only lookups to resolve a device and its parameters. Pulling in TypeORM and duplicating `backend`'s entity classes here would add a full ORM layer, a second copy of the schema to keep in sync, and a second migration story, for a service that only ever prepares a handful of hand-written SQL statements. A raw `mysql2` `Pool` with parameterized queries covers the actual need with a much smaller dependency footprint and startup cost — a deliberate simplification suited to the service's narrow scope, not a general recommendation against ORMs.

## Data Architecture Overview

`ingestion-service` owns no tables. It reads `organization`, `device`, `device_type`, and `device_type_param`, and writes only `device_telemetry` — all defined and migrated by `backend` (see `db-tables.md` and `../../backend/docs/db-tables.md`). This service connects to the same MySQL instance/database as `backend` via a separate connection pool.

## Component Interactions

| From | To | Purpose |
| ---- | -- | ------- |
| `IngestController` | `ApiKeyGuard` | Authenticate the request before the handler runs |
| `IngestController` | `IngestService.ingest()` | Delegate all resolution/validation/persistence |
| `IngestService` | `mysql2` pool | Resolve org → device → device_type_param; insert readings |
| `ApiKeyGuard` | `mysql2` pool | Resolve org by `:orgCode`, compare stored key hash |
| `AllExceptionsFilter` | HTTP response | Normalize any thrown error into the standard error JSON shape |

## Ingestion Processing Flow

```
POST /ingest/v1/:orgCode/:deviceType/:serialNo
  │
  ▼
ApiKeyGuard
  │  1. Read X-Api-Key header — missing → 401
  │  2. SELECT organization WHERE code = :orgCode — not found → 401 (same generic message)
  │  3. timingSafeEqual(providedKeyHash, storedKeyHash) — length/value mismatch → 401
  ▼
IngestController.ingest()
  │  Validates body shape via IngestTelemetryDto (class-validator)
  ▼
IngestService.ingest(orgId, deviceType, serialNo, dto)
  │  1. SELECT device WHERE org_id=? AND serial_no=? AND deleted_at IS NULL
  │     → not found: 404
  │  2. Compare resolved device's actual type to the :deviceType path segment
  │     → mismatch: 404 (identical error to "not found" — does not leak cross-type existence)
  │  3. Check device.connection_id IS NOT NULL
  │     → null (unassigned): 409
  │  4. For every reading in dto.readings:
  │       SELECT device_type_param WHERE device_type_id=? AND param_key=?
  │       → any missing: 422 (checked for ALL readings before any write proceeds)
  │  5. For every reading, INSERT INTO device_telemetry (...) VALUES (...)
  │       ON duplicate key error (ER_DUP_ENTRY): caught and swallowed (idempotent no-op)
  │       any other error: rethrown
  ▼
202 Accepted
```

The validate-then-write ordering in steps 4–5 is deliberate: partial writes followed by a validation failure on a later reading would leave the row set in an inconsistent, hard-to-reason-about state. All paramKeys are checked first; only if every reading is valid does any `INSERT` run.

## DTO Architecture

- `IngestTelemetryDto` — `deviceTimestamp: string` (ISO 8601, `@IsISO8601`), `readings: IngestReadingDto[]` (`@ValidateNested`, `@ArrayMinSize(1)`)
- `IngestReadingDto` — `paramKey: ParamKey` (`@IsEnum`), `value: number` (`@IsNumber`)

Both use `class-validator` decorators enforced by the global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) configured in `main.ts` — the same DTO-validation convention used in `backend`.

## Idempotency Design

`device_telemetry` carries a unique constraint on `(org_id, device_id, device_type_param_id, device_timestamp)` (defined and migrated in `backend`; see `../../backend/docs/db-tables.md`). `IngestService` does not pre-check for existence before inserting — it always attempts the `INSERT` and relies on the database to reject a duplicate via that constraint. A MySQL error whose `code` is `ER_DUP_ENTRY` is caught and treated as a successful no-op; any other error code is rethrown as a genuine failure. This equivalence-partition distinction (expected duplicate vs. real failure) is covered directly in `ingest.service.spec.ts`.

## Security Architecture

- **Authentication**: one API key per organization, presented via `X-Api-Key`, checked by `ApiKeyGuard` against a hash stored on the `organization` row.
- **Timing-safe comparison**: the guard uses Node's `crypto.timingSafeEqual` rather than `===`/`Buffer.equals`, and explicitly checks buffer length equality first — `timingSafeEqual` throws on mismatched lengths rather than returning `false`, so the length check must short-circuit before the call, not after.
- **Generic failure message**: "org not found" and "wrong key" both produce the same 401 body, so a caller cannot enumerate valid `orgCode` values by observing different error messages.
- **Path-scoped org, not body-trusted**: the organization is always taken from the URL's `:orgCode`, never from a client-supplied body field, closing off a spoofing vector.

## Error Handling Strategy

| Condition | Status | Notes |
| --------- | ------ | ----- |
| Missing/invalid `X-Api-Key` | 401 | `ApiKeyGuard`, before the controller runs |
| Unknown `:orgCode` | 401 | Same message as wrong key (see above) |
| Unknown `:serialNo` in org | 404 | |
| `:deviceType` path segment ≠ device's actual type | 404 | Identical error to "not found" |
| Device not linked to an account | 409 | |
| Reading's `paramKey` not configured for device type | 422 | Checked for all readings before any write |
| Malformed/missing `deviceTimestamp` or `readings` | 400 | `class-validator`, global `ValidationPipe` |
| Duplicate delivery (same reading twice) | 202 | Absorbed silently — not an error |
| Unhandled error | 500 | `AllExceptionsFilter`, uniform JSON shape |

All error responses share the same JSON shape as `backend`'s (see `../../backend/docs/api.md` for the shape), produced by this service's own `AllExceptionsFilter`.

## Testing

15 tests across 2 spec files, both at 100% statement/line/function/branch coverage:

| File | Tests | Notable technique |
| ---- | ----- | ------------------ |
| `ingest/ingest.service.spec.ts` | 8 | Validate-before-write ordering proven via exact `pool.query` call-count assertions; equivalence partition on insert error codes (`ER_DUP_ENTRY` swallowed vs. `ECONNRESET` rethrown) |
| `common/guards/api-key.guard.spec.ts` | 7 | Boundary case: malformed/wrong-length stored key hash rejects cleanly instead of crashing `timingSafeEqual` |

Both mock the `mysql2` `Pool.query()` interface directly (via the `DATABASE_POOL` injection token) rather than touching a real database, matching `backend`'s "mock the Repository/DataSource, never a real DB" testing convention. No e2e tests were written, for the same reasons documented in `../../backend/docs/technical-specifications.md`.
