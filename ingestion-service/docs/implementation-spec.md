# Implementation Specification

## Service Layer Architecture

### IngestService

| Method | Purpose |
| ------ | ------- |
| `ingest(orgId, deviceType, serialNo, dto)` | Resolves the device, validates linkage and every reading's `paramKey`, then persists all readings idempotently |

**Flow** (see `technical-specifications.md` for the full diagram):

1. Resolve the device by `(orgId, serialNo)`, excluding soft-deleted rows — 404 if not found.
2. Compare the resolved device's actual `deviceType` to the `:deviceType` path segment — 404 on mismatch (identical error to "not found," so a caller cannot distinguish "wrong type" from "doesn't exist").
3. Check `connectionId IS NOT NULL` — 409 if the device is still unassigned.
4. For every reading in the request, resolve `device_type_param` by `(deviceTypeId, paramKey, orgId)` — 422 if any reading's key doesn't resolve. All readings are checked before any write is attempted (validate-before-write ordering — see below).
5. For every reading, `INSERT INTO device_telemetry`. A `ER_DUP_ENTRY` error on a given insert is caught and swallowed (idempotent no-op); any other error is rethrown.

**Why validate all readings before writing any**: a request can carry multiple readings in one call (e.g. a meter's `TOTAL` + `FLOW` together). If reading 2's `paramKey` were invalid but reading 1 had already been inserted before the check ran, a retried request would then face a `deviceTimestamp` that's already partially persisted — a state harder to reason about than "nothing was written, retry the whole request." Resolving and validating every `paramKey` up front, before any `INSERT` runs, keeps the operation all-or-nothing from the caller's perspective.

**Why insert-then-catch, not check-then-insert, for idempotency**: pre-checking for existence before every insert would double the query count for the common case (a fresh, non-duplicate reading) purely to protect the rare case (a retried duplicate). Relying on the database's own unique constraint to reject the rare case, and catching that specific error code, keeps the common path to one round-trip per reading.

### ApiKeyGuard

| Method | Purpose |
| ------ | ------- |
| `canActivate(context)` | Resolves the org from `:orgCode`, timing-safe-compares the request's `X-Api-Key` against the stored hash |

**Flow**:

1. Read `X-Api-Key` from request headers — reject (401) if absent.
2. `SELECT apiKeySecretHash FROM organization WHERE id = :orgCode AND isActive = 1` — reject (401, same message) if no row.
3. Hash the provided key (SHA-256, matching how `apiKeySecretHash` was stored) and compare buffer lengths first, then `crypto.timingSafeEqual` — reject (401, same message) on either a length or value mismatch.
4. Allow the request through on match.

**Why the length check precedes `timingSafeEqual`**: Node's `crypto.timingSafeEqual` throws a `RangeError` if the two buffers differ in length, rather than returning `false` — so a malformed or wrong-length stored/provided key must be caught by an explicit length comparison first, or the guard itself would crash on a case it's supposed to reject cleanly. Covered directly by a boundary-case test in `api-key.guard.spec.ts` (a 4-byte stored hash vs. a real 32-byte SHA-256 digest).

**Why one generic 401 for every failure mode**: distinguishing "org not found" from "wrong key" in the response would let a caller enumerate valid `orgCode` values by observing which error they get back.

## Controller Layer

### IngestController

```typescript
@Controller('ingest/v1/:orgCode/:deviceType/:serialNo')
export class IngestController {
  @UseGuards(ApiKeyGuard)
  @Post()
  ingest(@Param() params, @Body() dto: IngestTelemetryDto) {
    return this.ingestService.ingest(params.orgCode, params.deviceType, params.serialNo, dto);
  }
}
```

`ApiKeyGuard` runs before the handler, so an unauthenticated request never reaches `IngestService` or triggers body validation. Body validation (`IngestTelemetryDto`) is enforced by the global `ValidationPipe` configured in `main.ts`, ahead of the handler body executing.

## Error Handling Patterns

| Situation | Exception thrown | Status |
| --------- | ----------------- | ------ |
| Missing/invalid API key, unknown org | `UnauthorizedException` | 401 |
| Device not found / type mismatch | `NotFoundException` | 404 |
| Device not linked to an account | `ConflictException` | 409 |
| Invalid `paramKey` for device type | `UnprocessableEntityException` | 422 |
| Malformed body | `class-validator` → `BadRequestException` (via global `ValidationPipe`) | 400 |
| Anything else | Caught by `AllExceptionsFilter`, normalized to the standard error shape | 500 |

## Dependencies

| Component | Injects | Purpose |
| --------- | ------- | ------- |
| `IngestService` | `DATABASE_POOL` (mysql2 `Pool`) | All device/param resolution and telemetry inserts |
| `ApiKeyGuard` | `DATABASE_POOL` (mysql2 `Pool`) | Organization/API-key lookup |
| `DatabaseModule` | `ConfigService` | Builds the `mysql2` pool from env-driven `database.config.ts`, provides it globally under the `DATABASE_POOL` token |

Both `IngestService` and `ApiKeyGuard` depend on the same injected pool token rather than opening their own connections — one pool, shared across the module, consistent with a stateless, horizontally-replicable service (see `technical-specifications.md`).

## Testing

15 tests across 2 spec files, both at 100% statement/line/function/branch coverage. See `technical-specifications.md` — Testing for the full table. Both spec files mock the `mysql2` `Pool.query()` interface directly via the `DATABASE_POOL` token; neither touches a real database, matching `backend`'s testing convention (see `../../backend/docs/implementation-spec.md`).

Notable design choices in the tests themselves:

- **Validate-before-write ordering** is proven, not assumed: a test sends two readings where the second `paramKey` is invalid, then asserts `pool.query` was called exactly 3 times (device lookup + 2 param lookups) and zero `INSERT` calls occurred — demonstrating the all-or-nothing behavior directly rather than just asserting the final error status.
- **Idempotency equivalence partition**: one test asserts an `ER_DUP_ENTRY`-coded error from `pool.query` is swallowed and `ingest()` resolves cleanly; a second asserts a differently-coded error (`ECONNRESET`) is rethrown — proving the catch is scoped to the specific expected duplicate-key case, not a blanket try/catch that would also hide real failures.
- **Guard boundary case**: a malformed/wrong-length stored key hash is asserted to reject cleanly (401) rather than crash the process, exercising the `timingSafeEqual` length-check-first ordering described above.
