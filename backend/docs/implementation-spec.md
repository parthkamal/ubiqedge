# Implementation Specification

## Service Layer Architecture

### AuthService (`auth/auth.service.ts`)

Login and JWT issuance only — no refresh-token flow, no forgot-password (documented limitations).

| Method  | Parameters              | Returns                    | Description                              |
| --------| --------------------------| -----------------------------| ---------------------------------------------|
| `login` | `email, password`       | `Promise<{accessToken}>`   | Verify credentials, issue JWT              |

**Login flow**: find user by email (globally unique, no org filter) → reject if not found or `isActive=false` → `bcrypt.compare` the password → reject on mismatch → sign `{ sub: userId, orgId, roleType }`. All three rejection paths return the identical `UnauthorizedException('Invalid credentials')` — a security property, not an oversight: the caller can never use the error to learn whether an email is registered.

---

### UserService (`user/user.service.ts`)

| Method    | Parameters                  | Returns                            | Description                     |
| ----------| ------------------------------| --------------------------------------| ------------------------------------|
| `create`  | `dto, currentUser`          | `Promise<UserResponseDto>`         | Create user, hash password       |
| `findAll` | `query, currentUser`        | `Promise<PaginatedResult<...>>`    | List, org-scoped, search + role filter |
| `findMe`  | `currentUser`                | `Promise<UserResponseDto>`         | Own profile                      |
| `findOne` | `id, currentUser`            | `Promise<UserResponseDto>`         | By id, org-scoped                |
| `update`  | `id, dto, currentUser`       | `Promise<UserResponseDto>`         | Partial update                   |
| `remove`  | `id, currentUser`            | `Promise<void>`                    | Soft delete                      |

**Partial update pattern**: assigns each field individually (`if (dto.x !== undefined) entity.x = dto.x`), never `Object.assign(entity, dto)`. A real bug was found and fixed here during manual testing: `Object.assign` silently nulled out every field the caller didn't send, because a DTO's declared-but-unsent optional fields exist as own properties valued `undefined` under TypeScript's `useDefineForClassFields`. Regression-tested (`user.service.spec.ts`).

**Create validation order**: duplicate email (409) → role not configured for org (500 — a setup bug, logged with context, not a client error) → bcrypt hash (10 rounds) → insert.

---

### AccountService (`account/account.service.ts`)

| Method         | Parameters                | Returns                          | Description                          |
| ---------------| ----------------------------| -------------------------------------| ------------------------------------------|
| `create`       | `dto, currentUser`         | `Promise<AccountResponseDto>`     | Link a Customer user to a new account |
| `findAll`      | `query, currentUser`       | `Promise<PaginatedResult<...>>`   | List, org-scoped, search + userId filter |
| `findOne`      | `id, currentUser`           | `Promise<AccountResponseDto>`     | By id                                |
| `findMine`     | `currentUser`               | `Promise<AccountResponseDto>`     | Own account                          |
| `updateStatus` | `id, dto, currentUser`      | `Promise<AccountResponseDto>`     | ACTIVE ⇄ SUSPENDED                    |

**Create validation order**: target user exists in org (404) → user is Customer role (400) → user doesn't already have an account (409) → two-step `accountNo` generation inside a transaction.

**Two-step generated-identifier pattern** (shared with `DeviceService.create` and `InvoiceService.generateForDevice`): insert a placeholder value that satisfies the `NOT NULL` constraint, then update the row with the real value derived from its own auto-increment id, both inside one transaction.

---

### DeviceService (`device/device.service.ts`)

| Method            | Parameters                | Returns                           | Description                             |
| -------------------| ----------------------------| --------------------------------------| ---------------------------------------------|
| `listDeviceTypes` | `currentUser`               | `Promise<DeviceTypeResponseDto[]>` | Seed-data lookup                        |
| `create`          | `dto, currentUser`          | `Promise<DeviceResponseDto>`       | Two-step serialNo generation             |
| `findAll`         | `query, currentUser`        | `Promise<PaginatedResult<...>>`    | List, filters: connectionId/type/unassigned |
| `findMine`        | `currentUser`                | `Promise<DeviceResponseDto[]>`     | Own devices (unpaginated — bounded)      |
| `findOne`         | `id, currentUser`            | `Promise<DeviceResponseDto>`       | Admin or owning Customer (decision table below) |
| `update`          | `id, dto, currentUser`       | `Promise<DeviceResponseDto>`       | Rename/(de)activate/(un)assign            |
| `remove`          | `id, currentUser`            | `Promise<void>`                    | Soft delete                              |

**`findAll` filter precedence**: `unassigned=true` overrides an explicit `connectionId` if both are somehow sent together — deliberate, not an omission.

**`findOne` ownership rule** (decision table — `role × isOwner`):

| Role     | Owns the device | Result  |
| ----------| -----------------| -----------|
| Admin    | —                | Allowed |
| Customer | Yes              | Allowed |
| Customer | No               | Denied (404, not 403) |

**Assign/unassign bug (fixed, regression-tested)**: setting only the scalar `device.connectionId = null` did not persist, because `device.connection` — the relation object, still loaded on the fetched entity — was re-derived by TypeORM on save and silently overrode the scalar-only change. Fixed by nulling (or setting) both `connectionId` and `connection` together. Covered by `device.service.spec.ts`.

---

### TelemetryService (`telemetry/telemetry.service.ts`)

Query-only — no write path (that's `ingestion-service`'s job entirely).

| Method          | Parameters                     | Returns                          | Description                        |
| -----------------| ---------------------------------| -------------------------------------| ---------------------------------------|
| `findForDevice` | `deviceId, query, currentUser`  | `Promise<PaginatedResult<...>>`   | Consumption view, delegates ownership to `DeviceService.findOne` |

**Range resolution** (private `resolveRange`):

| Input                    | Resolved window                                  |
| ---------------------------| ------------------------------------------------------|
| `range=1d` / `7d` / `30d` | Fixed window ending now                            |
| `range=custom`            | Requires explicit `from` and `to` (400 if either missing) |
| No `range`                | Legacy default: 7 days ending now, honoring explicit `from`/`to` if given |

**Inclusive-upper-bound bug (fixed, regression-tested with boundary value analysis)**: a bare date string (`"2026-08-11"`) parses to midnight UTC — correct as a lower bound, but as an upper bound it silently excluded every reading actually on that calendar day. Fixed by bumping bare-date-only upper bounds to `23:59:59.999`; a full datetime with an explicit time component is respected as-is (forcing it to day-end would silently widen a precise time-window request). Covered by `telemetry.service.spec.ts` with exact-millisecond assertions via fake timers.

**paramKey validation**: must resolve to a `device_type_param` configured for the org *and* belonging to the same device type as the target device — either failure collapses to the same 400.

---

### PricingService (`pricing/pricing.service.ts`)

| Method       | Parameters             | Returns                                | Description                            |
| --------------| -------------------------| -------------------------------------------| -------------------------------------------|
| `create`     | `dto, currentUser`      | `Promise<PricingConfigResponseDto>`     | Auto-closes prior active config, validates SLAB structure |
| `findAll`    | `query, currentUser`    | `Promise<PaginatedResult<...>>`         | Active + superseded configs, filter by type |
| `findActive` | `query, currentUser`    | `Promise<PricingConfigResponseDto>`     | Currently active config for a type      |

**`validateSlabStructure`** (private, equivalence-partition-tested): sorts tiers by `slabFrom`, then enforces — first tier starts at 0; every non-last tier specifies `slabTo` and is contiguous with the next (`slabTo === nextSlab.slabFrom`); only the last tier may omit `slabTo` (unbounded); every tier's `slabTo > slabFrom`.

**Auto-close pattern** (inside `create`'s transaction): find the currently-active config for the device type (`effectiveTo IS NULL`) → if found, set its `effectiveTo` to the new config's `effectiveFrom` and save → then insert the new config (+ slabs if SLAB). Keeps coverage contiguous with no gap or overlap, with no application-enforced overlap check needed beyond this.

---

### InvoiceService (`invoice/invoice.service.ts`)

The largest and most business-logic-heavy service.

| Method               | Parameters                        | Returns                              | Description                                |
| ----------------------| -------------------------------------| -----------------------------------------| -------------------------------------------------|
| `generateForPeriod`  | `dto, currentUser`                  | `Promise<GenerateInvoicesResultDto>`  | The one entry point — admin-triggered batch run |
| `findAll`            | `query, currentUser`                | `Promise<PaginatedResult<...>>`       | Admin list, all filters                     |
| `findMine`           | `query, currentUser`                | `Promise<PaginatedResult<...>>`       | Customer's own invoices                     |
| `findOne`            | `id, currentUser`                    | `Promise<InvoiceResponseDto>`         | Admin or owning Customer                    |
| `cancel`             | `id, currentUser`                    | `Promise<InvoiceResponseDto>`         | PENDING/PAID → CANCELLED (rejects PAID)     |
| `generateForDevice`  | *(private)* `device, periodEnd, orgId, totalParamId` | `Promise<DeviceOutcome>`  | Per-device checkpoint resolution + insert   |
| `computeAmount`      | *(private)* `consumptionUnits, config` | `{amount, appliedUnitRate}`         | FIXED or SLAB calculation                   |

**`generateForPeriod` flow**: validate period (both bounds together, or neither; start before end) → resolve org's `TOTAL` param (400 if not configured) → find all billed, active, account-linked devices → for each device independently (try/caught): call `generateForDevice`; a `QueryFailedError` (duplicate period) is caught and recorded as a skip reason, not rethrown; any other error is logged with device context and also recorded as a skip, never aborting the batch.

**`generateForDevice` flow** (opening-checkpoint anchoring — see `db-tables.md` for the exact anchor SQL):

1. Find the last non-`CANCELLED` invoice for this device → its `closingCheckpointId`/`closingReading`/`billingPeriodEnd` become this invoice's opening values.
2. If no prior invoice exists (first invoice ever), fall back to the device's earliest `TOTAL` telemetry row; skip with reason if none exists yet.
3. Find the latest `TOTAL` reading at or before the period end (closing checkpoint); skip with reason if none exists or it's identical to the opening checkpoint (no new telemetry — a real data gap, not a confirmed zero-consumption period, so no invoice is fabricated).
4. Compute `consumptionUnits = closing - opening`; skip with reason if negative (meter reset/replacement — needs manual review, not an automatic bill).
5. Resolve the active `pricing_config` for the device's type; skip with reason if none.
6. `computeAmount()`, then insert the invoice inside a transaction using the two-step `serialNo` pattern.

**`computeAmount`** (boundary-value-tested at tier edges):

- `FIXED`: `amount = consumptionUnits * fixedRate`.
- `SLAB`: sort tiers ascending, walk them charging `min(remaining, tierSize)` units at each tier's rate until `remaining` is exhausted; `appliedUnitRate = amount / consumptionUnits` (0 if consumption is 0) — the single blended rate stored on the invoice, not a line-item-per-tier breakdown.

**Idempotency**: `customer_invoice(deviceId, billingPeriodStart, billingPeriodEnd)` is unique — re-running generation for an already-invoiced period is a safe no-op per device, not an error, so the endpoint is safe to call repeatedly.

---

### PaymentService (`payment/payment.service.ts`)

| Method            | Parameters                            | Returns                                  | Description                              |
| -------------------| -----------------------------------------| ---------------------------------------------| -----------------------------------------------|
| `initiate`         | `invoiceId, currentUser`               | `Promise<PaymentSessionResponseDto>`      | Create INITIATED transaction, mock session |
| `findForInvoice`   | `invoiceId, currentUser`                | `Promise<PaymentTransactionResponseDto[]>` | Payment attempt history                   |
| `handleWebhook`    | `provider, dto, rawBody`                | `Promise<void>`                          | Signature-verified, idempotent update      |
| `getOwnedInvoice`  | *(private)* `invoiceId, currentUser, {allowAdmin}` | `Promise<CustomerInvoice>`         | Shared ownership check                    |

**`getOwnedInvoice` ownership rule** (decision table — `role × isOwner × allowAdmin`, since the two callers fix `allowAdmin` differently):

| Caller            | allowAdmin | Role     | Owns the invoice | Result  |
| --------------------| ------------| ----------| -------------------| -----------|
| `initiate`          | false      | Customer | Yes                | Allowed |
| `initiate`          | false      | Customer | No                 | Denied  |
| `initiate`          | false      | Admin    | (irrelevant)       | Denied — no admin bypass on payment initiation |
| `findForInvoice`    | true       | Customer | Yes                | Allowed |
| `findForInvoice`    | true       | Customer | No                 | Denied  |
| `findForInvoice`    | true       | Admin    | (irrelevant)       | Allowed — admin bypass |

**`handleWebhook` idempotency**: find the transaction by `(provider, providerTransactionId)` inside a transaction → if not found, log and acknowledge without throwing (a provider retrying a webhook for something unrecognized must not get an error that triggers more retries) → update the transaction's status → **only if** the outcome is `SUCCESS` **and** the invoice is still `PENDING`, mark it `PAID` and stamp `transactionId`/`transactionProvider` — a retried `SUCCESS` webhook against an already-`PAID` invoice is naturally a no-op on the invoice (though the transaction row itself is still re-saved, harmlessly).

**`checkoutUrl`**: a placeholder (`https://mock-gateway.local/checkout/:id`) — there is no real hosted checkout page behind it. The only way an invoice reaches `PAID` is the webhook, which nothing in the browser can trigger (it needs the shared HMAC secret) — this is by design, to demonstrate the real webhook-driven settlement pattern without building a real gateway integration.

---

## Controller Layer Architecture

All controllers follow the same shape:

```typescript
@ApiBearerAuth()
@Controller('resource')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Roles(RoleType.ADMIN)          // omitted where both roles + service-level ownership applies
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.resourceService.findOne(id, currentUser);
  }
}
```

**Guard stack** (global, via `APP_GUARD` in `app.module.ts`, order matters):

1. `JwtAuthGuard` — verifies the JWT, populates `request.user`; opted out with `@Public()`.
2. `RolesGuard` — reads `request.user.roleType` against `@Roles(...)`; no `@Roles()` means "any authenticated role", with finer ownership checks left to the service.

`PaymentWebhookController` uses `@Public()` + its own `PaymentSignatureGuard` instead of the JWT stack entirely, and declares a literal `VERSION_NEUTRAL` path (`payments/v1/webhook`) rather than participating in global URI versioning — versioning would otherwise insert `/v1/` *before* the global-prefix-excluded `payments` segment, giving the wrong shape.

`MyDeviceController`/`MyInvoiceController`/`TelemetryController` live inside a different module than their URL prefix suggests (`DeviceModule`/`InvoiceModule`/`TelemetryModule` respectively) — each already depends one-directionally on the module it borrows from, and co-locating there avoids introducing a circular module dependency the other way.

---

## Validation Layers

### DTO Validation

- `class-validator` decorators, global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Regex-constrained fields: `phoneNumber` (`/^[0-9]{7,15}$/`), `pincode` (`/^[0-9]{4,10}$/`).
- `@ValidateIf` for mutually-exclusive-by-mode fields (`CreatePricingConfigDto.fixedRate`/`slabs`, gated on `rateType`).

### Service-Layer Validation

- Uniqueness (email, accountNo-per-user, device-per-org, etc.) checked via an existence query before insert, not left to the DB constraint alone — so the error is a meaningful 409/400, not a raw `QueryFailedError`.
- Slab structure, ownership, org scoping, role-appropriateness (e.g. "only Customer users can have an account") — all business-meaning validation lives here, not in DTOs.

---

## Error Handling Patterns

| Error Type                               | Response                            |
| --------------------------------------------| ------------------------------------------|
| Resource not found / not owned            | `NotFoundException` (404)             |
| Invalid input shape                       | `BadRequestException` (400), from ValidationPipe or explicit service checks |
| Invalid credentials                       | `UnauthorizedException` (401)         |
| Duplicate unique constraint                | `ConflictException` (409) where caught explicitly, else normalized to 409 by the global filter |
| Org/role misconfiguration                 | `InternalServerErrorException` (500), logged with context — a setup bug, not a client error |

All errors are normalized by `AllExceptionsFilter` (`common/filters/all-exceptions.filter.ts`) to `{ statusCode, message, error, path, timestamp }`, including unhandled `QueryFailedError`s from TypeORM.

---

## Testing

144 unit tests across 9 spec files, all mocking `Repository`/`DataSource` (or the injected service, for `TelemetryService`'s `DeviceService` dependency) — no test touches a real database, per this project's convention (functional correctness verified separately via live curl/browser testing throughout the build, not automated e2e).

| Spec file                         | Tests | Notable technique                                                     |
| -------------------------------------| --------| --------------------------------------------------------------------------|
| `invoice.service.spec.ts`          | 28    | Boundary value analysis on slab tier edges; opening-checkpoint anchoring across all branches |
| `device.service.spec.ts`           | 21    | Decision table (`role × isOwner`); regression test for the assign/unassign FK-desync bug |
| `pricing.service.spec.ts`          | 19    | Equivalence-partition table for slab-structure validity classes        |
| `payment.service.spec.ts`          | 15    | Decision table (`role × isOwner × allowAdmin`); idempotent webhook retry |
| `user.service.spec.ts`             | 12    | Regression test for the `Object.assign` partial-update bug              |
| `account.service.spec.ts`          | 12    | Equivalence partition on role-eligibility for account creation          |
| `telemetry.service.spec.ts`        | 12    | Boundary value analysis on the inclusive-upper-bound date bug; fake-timer-based window assertions |
| `auth.service.spec.ts`             | 5     | Equivalence partition proving three failure reasons collapse to one identical response |
| `create-user.dto.spec.ts`          | 19    | Boundary value analysis directly against `class-validator` (`phoneNumber`/`pincode`/`password` length boundaries) |

---

## Dependencies

### Repository Dependencies (per service)

| Service           | Repositories Injected                                                         |
| --------------------| -----------------------------------------------------------------------------------|
| AuthService        | User                                                                          |
| UserService        | User, Role                                                                    |
| AccountService     | CustomerConnection, User, DataSource                                          |
| DeviceService      | Device, DeviceType, CustomerConnection, DataSource                            |
| TelemetryService   | DeviceTelemetry, DeviceTypeParam, + DeviceService (injected, not a repository) |
| PricingService     | PricingConfig, DeviceType, DataSource                                         |
| InvoiceService     | CustomerInvoice, Device, DeviceTelemetry, DeviceTypeParam, PricingConfig, CustomerConnection, DataSource |
| PaymentService     | PaymentTransaction, CustomerInvoice, DataSource                               |

`DataSource` is injected wherever a transaction spans more than one entity type or needs the two-step generated-identifier pattern.
