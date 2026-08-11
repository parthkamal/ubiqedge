# Technical Specifications

## Service Overview

`backend` is built on NestJS 11 with TypeORM 0.3 for persistence against MySQL 8. It exposes two prefixes: `/api/v1` (JWT-authenticated CRUD/query surface) and `/payments/v1` (signature-authenticated webhook ingress, deliberately excluded from the global prefix and from URI versioning). It does not own the telemetry write path — that is `ingestion-service`'s sole responsibility (see `../../ingestion-service/docs/`), reachable independently and scaled independently.

- **Source Location**: `src/`
- **Framework**: NestJS 11 + TypeScript 5
- **Database**: MySQL 8 via `@nestjs/typeorm` + `typeorm`
- **Auth**: `passport-jwt`, `bcrypt`

## Module Structure

```
src/
├── main.ts                        # Bootstrap: prefix, versioning, ValidationPipe, exception filter, Swagger
├── app.module.ts                  # Root module: config, TypeORM, global guards, all feature modules
├── common/
│   └── filters/all-exceptions.filter.ts   # Normalizes every error to { statusCode, message, error, path, timestamp }
├── config/
│   ├── database.config.ts         # registerAs('database', ...)
│   ├── jwt.config.ts              # registerAs('jwt', ...)
│   └── payment.config.ts          # registerAs('payment', ...)
├── database/
│   ├── data-source.ts             # Standalone DataSource for the TypeORM CLI (migrations)
│   ├── typeorm.config.ts          # Runtime TypeOrmModule config (autoLoadEntities, timezone: 'Z')
│   └── migrations/                # 14 migrations, one table per file + 2 index-only additions
├── auth/                          # AuthModule — login, JWT strategy, guards, decorators
├── organization/                  # OrganizationModule — entity only, seed-driven, no controller
├── user/                          # UserModule — user + role entities, user CRUD
├── account/                       # AccountModule — customer_connection CRUD, status
├── device/                        # DeviceModule — device + device_type + device_type_param
├── telemetry/                     # TelemetryModule — consumption query only (no writes)
├── pricing/                       # PricingModule — pricing_config + pricing_slab
├── invoice/                       # InvoiceModule — admin-triggered generation, invoice CRUD
└── payment/                       # PaymentModule — mock gateway session + webhook ingress
```

Each feature module directory follows the same internal shape: `*.module.ts`, `*.controller.ts` (one or more), `*.service.ts`, `dto/*.ts`, `entities/*.ts`.

Module names are singular (`UserModule`, not `UsersModule`) — `TelemetryModule`/`PricingModule`/`OrganizationModule` stay as-is since those nouns are already singular/uncountable.

## Data Architecture Overview

### Primary Data Concepts

| Concept            | Description                                            |
| -------------------| ---------------------------------------------------------|
| Organization       | Tenancy root; `id` is the human-readable org code       |
| User               | Admin or Customer; email globally unique                |
| CustomerConnection | "Account" in the FR; 1:1 with User                      |
| DeviceType         | METER or TANK, with a `billed` flag                     |
| DeviceTypeParam    | Which telemetry params exist per org (TOTAL/FLOW/LEVEL) |
| Device             | A meter or tank; may be unassigned (`connectionId` null) |
| DeviceTelemetry    | Append-only reading stream, written by ingestion-service |
| PricingConfig      | Active/historical rate structure per device type        |
| PricingSlab        | Tier rows for SLAB-rate configs                         |
| CustomerInvoice    | One row per device per billing period                   |
| PaymentTransaction | One row per payment attempt against an invoice          |

### Aggregate Boundaries

- Every table (except the two junction-like child tables `pricing_slab` and, implicitly, `device_type_param`) carries a denormalized `orgId`, enforced at the service layer on every query — never inferred from a joined parent alone.
- Ownership for Customer-facing endpoints resolves through `device.connectionId → customer_connection.userId`, not a direct FK from user to device.

## Component Interactions

### Controllers and Services

| Controller               | Service          | Responsibility                                             |
| ------------------------- | ------------------| --------------------------------------------------------------|
| AuthController            | AuthService      | Login, JWT issuance                                         |
| UserController            | UserService      | User CRUD, own-profile lookup                                |
| AccountController         | AccountService   | Account CRUD, status transitions                              |
| DeviceController          | DeviceService    | Device CRUD                                                  |
| MyDeviceController        | DeviceService    | Customer's own device list (`/accounts/me/devices`)          |
| DeviceTypeController      | DeviceService    | Device type lookup (seed data)                                |
| TelemetryController       | TelemetryService | Consumption query (`/devices/:id/telemetry`)                  |
| PricingController         | PricingService   | Pricing config CRUD, active-config lookup                     |
| InvoiceController         | InvoiceService   | Admin-triggered generation, invoice CRUD                      |
| MyInvoiceController       | InvoiceService   | Customer's own invoices (`/accounts/me/invoices`)             |
| PaymentController         | PaymentService   | Payment session init, payment attempt log                     |
| PaymentWebhookController  | PaymentService   | Signature-verified webhook ingress                            |

`MyDeviceController` and `MyInvoiceController` live inside `DeviceModule`/`InvoiceModule` respectively, despite serving the `/accounts/me/...` URL prefix — each module already has a one-directional dependency on the module it borrows a repository/service from, so co-locating there avoids introducing a circular module dependency the other way around.

### Invoice Generation Flow

```
POST /invoices/generate (Admin)
  → InvoiceController.generate()
  → InvoiceService.generateForPeriod(dto, currentUser)
      resolve billing period (explicit, or previous calendar month)
      resolve org's TOTAL device_type_param
      find all billed, active, account-linked devices
      for each device (independently try/caught):
        → generateForDevice(device, periodEnd, orgId, totalParamId)
            resolve opening checkpoint (last invoice's close, or earliest telemetry)
            resolve closing checkpoint (latest TOTAL reading <= period end)
            skip if: no telemetry / no new telemetry / negative consumption / no active pricing config
            resolve active pricing_config for device's deviceTypeId
            computeAmount() — FIXED or SLAB walk
            insert customer_invoice inside one DB transaction
      aggregate { generated, skipped[] }
```

### Payment Webhook Flow

```
POST /payments/v1/webhook/:provider (no JWT — PaymentSignatureGuard)
  → PaymentWebhookController.handle()
  → PaymentService.handleWebhook(provider, dto, rawBody)
      inside one DB transaction:
        find payment_transaction by (provider, providerTransactionId)
        if not found: log + acknowledge (no throw — providers retry unrecognized webhooks)
        else: update transaction status
              if SUCCESS and invoice still PENDING: mark invoice PAID (idempotent no-op if already PAID)
```

## DTO Architecture

### Create/Update DTOs

| DTO                    | Purpose                                       |
| ------------------------| ------------------------------------------------|
| CreateUserDto           | User creation (all fields, incl. password/role) |
| UpdateUserDto           | Partial update — excludes email/password/roleType |
| CreateAccountDto        | Account creation (just `userId`)                |
| UpdateAccountStatusDto  | Status transition (`ACTIVE`/`SUSPENDED`)         |
| CreateDeviceDto         | Device creation — `connectionId` optional        |
| UpdateDeviceDto         | Partial update — excludes `type` (immutable)     |
| CreatePricingConfigDto  | FIXED or SLAB config creation                    |
| CreatePricingSlabDto    | One tier within a SLAB config                    |
| GenerateInvoicesDto     | Optional explicit billing period                 |
| LoginDto                | `{ email, password }`                            |
| PaymentWebhookDto       | Mock provider's webhook payload shape            |

### List Query DTOs

Every list endpoint's query DTO shares the same pagination base (`page` default 1, `limit` default 20/max 100), plus resource-specific filters — see `api.md` for the exact field list per endpoint.

## Validation Architecture

- `class-validator` decorators on every DTO; global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` in `main.ts` — unknown fields are rejected outright, not silently dropped.
- Regex-constrained fields: `phoneNumber` (7-15 digits), `pincode` (4-10 digits).
- Business-rule validation (slab contiguity, ownership, uniqueness) lives in the service layer, not the DTO — DTOs validate shape, services validate meaning.

## Processing Flows

### Two-Step Generated-Identifier Insert

`accountNo`, device `serialNo`, and invoice `serialNo` are all derived from the row's own auto-increment id (e.g. `ORG01-METER-000001`). Each is created via the same pattern inside a transaction: insert with a placeholder value that satisfies the `NOT NULL` constraint, then update the row with the real value once its id exists.

### Device Assign/Unassign

Reassigning or unassigning a device (`UpdateDeviceDto.connectionId`) requires setting **both** the scalar `connectionId` column and the `connection` relation object together on the entity before saving — TypeORM re-derives the FK column from an eagerly-loaded relation object on save, so a scalar-only assignment gets silently overwritten if the relation isn't also updated (see `implementation-spec.md` for the bug history behind this).

### Partial Update

Every `update()` method assigns fields explicitly per-field (`if (dto.x !== undefined) entity.x = dto.x`), never via `Object.assign(entity, dto)` — a DTO's declared-but-unsent optional fields exist as own properties valued `undefined` (TypeScript's `useDefineForClassFields`), so a blanket `Object.assign` would null out every field the caller didn't actually send.

## Transaction Management

### Atomic Operations

- Account/device/invoice creation with a generated identifier: two-step insert, one transaction.
- Pricing config creation: auto-close of the previous active config + insert of the new config (+ slabs), one transaction.
- Invoice generation: per-device, one transaction per device (a failure on one device doesn't roll back another's).
- Payment webhook: transaction status update + invoice status update, one transaction.

### Consistency Guarantees

- Every FK relation uses `{ onDelete: 'RESTRICT' }` — soft delete is used instead of cascading/nulling deletes, so a hard `DELETE` on a still-referenced row fails loudly rather than corrupting history.
- `user`, `customer_connection`, `device` are soft-deletable (`@DeleteDateColumn`); `customer_invoice` and `payment_transaction` are not — financial records use the `CANCELLED` status instead, preserving the audit trail rather than hiding the row.

## Query and Retrieval Design

### Search

- Case-insensitive `LIKE '%term%'` expressed as an array of `FindOptionsWhere` (TypeORM's OR-across-fields idiom), each variant still AND-ed with the org-scoping base filter.

### Pagination

- `?page=&limit=` → `{ data: [], meta: { page, limit, total } }`, via `findAndCount` + `skip`/`take`, consistently across every list endpoint.

### Telemetry Range Resolution

- `range=1d|7d|30d` resolve to a fixed window ending "now".
- `range=custom` requires explicit `from`/`to`.
- No `range` given falls back to a legacy 7-day default, still honoring explicit `from`/`to` if provided.
- A bare date string (`"2026-08-11"`) used as an upper bound is bumped to end-of-day (`23:59:59.999`) so the whole calendar day is inclusive; a full datetime with an explicit time component is respected as-is.

## Security Architecture

### Authentication

- `JwtAuthGuard` + `RolesGuard` applied globally via `APP_GUARD` (order matters: `JwtAuthGuard` populates `request.user` before `RolesGuard` reads it), opted out per-route with `@Public()` (login, payment webhook).
- `@CurrentUser()` decorator extracts `{ userId, orgId, roleType }` from the verified JWT — every service method takes this as a parameter and never trusts a client-supplied org/user id.

### Authorization

- `@Roles(RoleType.ADMIN | RoleType.CUSTOMER)` on routes restricted to one role.
- Routes reachable by both roles (device/invoice/payment detail) omit `@Roles()` and enforce "Admin or the owning Customer" inside the service, 404-ing (not 403-ing) a non-owned resource.
- `PaymentSignatureGuard` (HMAC, timing-safe compare) protects the payment webhook instead of JWT.

### Multi-Tenant Isolation

- Enforced by the service layer reading `orgId` off `@CurrentUser()` and applying it to every query — the guards alone do not enforce tenancy.

## Error Handling Strategy

| Error Type                       | Response                                                          |
| ---------------------------------- | ---------------------------------------------------------------------|
| Validation failure                | `BadRequestException` (400)                                       |
| Resource not found / not owned    | `NotFoundException` (404)                                          |
| Invalid credentials               | `UnauthorizedException` (401)                                      |
| Duplicate unique constraint       | `QueryFailedError` → normalized to 409 by the global filter, or caught explicitly for idempotent-retry cases (invoice generation, telemetry ingest) |
| Org misconfiguration (missing role/device-type) | `InternalServerErrorException` (500) — a setup bug, not a client error |

All errors are normalized by `AllExceptionsFilter` to `{ statusCode, message, error, path, timestamp }`.

## Migration Workflow

- `src/database/data-source.ts` is a standalone `DataSource` for the TypeORM CLI (glob entity discovery), separate from the Nest runtime's `TypeOrmModule.forRootAsync` (which uses `autoLoadEntities`).
- `synchronize` is always `false` — migrations are the only source of truth for schema.
- `npm run migration:show|run|revert|generate` all build first, then run the CLI against compiled `dist/database/data-source.js`.
- One `CREATE TABLE` per migration file (12), plus 2 index-only migrations added later — never one giant generated diff committed as-is.
- Each migration was validated with a full run → revert (to empty) → run cycle against a live MySQL container before being treated as final.

## Testing

- Unit tests only (Jest), 144 tests across 9 spec files — one per service with real branching logic (Invoice, Pricing, Payment, User, Account, Device, Telemetry, Auth).
- Repository/DataSource are always mocked — no test touches a real database; functional correctness was verified separately via live curl/browser testing against a throwaway MySQL container throughout the build.
- Test design deliberately uses equivalence partitioning (e.g. slab-structure validity classes), boundary value analysis (e.g. tier-edge consumption, telemetry date-bump boundary), and decision tables (e.g. the `role × isOwner × allowAdmin` ownership rule) rather than ad hoc examples — see `implementation-spec.md` for the per-service test breakdown.
- e2e/integration tests are out of scope for this build (documented limitation, not a correctness gap — see root `README.md`).
