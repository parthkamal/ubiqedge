# API Documentation

## Routes Overview

Two independently versioned prefixes:

- `/api/v1/...` — JWT-authenticated CRUD/query surface (this document's main focus)
- `/payments/v1/...` — signature-authenticated webhook ingress, excluded from the global `/api` prefix and from URI versioning (see `payments/v1/webhook/:provider` below)

All `/api/v1` endpoints require a valid JWT (`Authorization: Bearer <token>`) except `POST /auth/login`. Role restriction is noted per endpoint; where both roles can reach an endpoint but only the owner should see the data, that's enforced inside the service (404, not 403, for a non-owned resource).

## Endpoints

### Auth

#### POST /auth/login

- **Purpose**: Authenticate and receive a JWT access token
- **Method**: POST
- **Authentication**: None (`@Public()`)
- **Request Body**: LoginDto
- **Response**: `{ accessToken: string }`
- **Notes**: No self-signup — Admin creates all users. Failure is always the same generic 401 regardless of reason (unknown email, deactivated user, wrong password).

### Users

#### POST /users

- **Purpose**: Create a user (Admin or Customer)
- **Method**: POST
- **Authorization**: Admin
- **Request Body**: CreateUserDto
- **Response**: UserResponseDto (201)

#### GET /users

- **Purpose**: List users in the caller's org, paginated
- **Method**: GET
- **Authorization**: Admin
- **Query Parameters**: `search?`, `page` (default 1), `limit` (default 20, max 100), `roleType?`
- **Response**: `{ data: UserResponseDto[], meta: { page, limit, total } }`

#### GET /users/me

- **Purpose**: Get the caller's own profile
- **Method**: GET
- **Authorization**: any authenticated role
- **Response**: UserResponseDto

#### GET /users/:id

- **Purpose**: Get a user by id
- **Method**: GET
- **Authorization**: Admin
- **Response**: UserResponseDto (404 if not found or in a different org)

#### PATCH /users/:id

- **Purpose**: Update a user (partial)
- **Method**: PATCH
- **Authorization**: Admin
- **Request Body**: UpdateUserDto
- **Response**: UserResponseDto

#### DELETE /users/:id

- **Purpose**: Soft-delete a user
- **Method**: DELETE
- **Authorization**: Admin
- **Response**: 204 No Content

### Accounts

#### POST /accounts

- **Purpose**: Create an account, linking a Customer user
- **Method**: POST
- **Authorization**: Admin
- **Request Body**: CreateAccountDto
- **Response**: AccountResponseDto (201)
- **Errors**: 404 (user not found), 400 (user is not Customer role), 409 (user already has an account)

#### GET /accounts

- **Purpose**: List accounts in the caller's org, paginated
- **Method**: GET
- **Authorization**: Admin
- **Query Parameters**: `search?`, `page`, `limit`, `userId?` (exact match)
- **Response**: `{ data: AccountResponseDto[], meta }`

#### GET /accounts/me

- **Purpose**: Get the caller's own account
- **Method**: GET
- **Authorization**: Customer
- **Response**: AccountResponseDto (404 if the caller has no account yet)

#### GET /accounts/:id

- **Purpose**: Get an account by id
- **Method**: GET
- **Authorization**: Admin
- **Response**: AccountResponseDto

#### PATCH /accounts/:id/status

- **Purpose**: Change account status (ACTIVE/SUSPENDED)
- **Method**: PATCH
- **Authorization**: Admin
- **Request Body**: UpdateAccountStatusDto
- **Response**: AccountResponseDto

### Devices

#### POST /devices

- **Purpose**: Create a meter or tank
- **Method**: POST
- **Authorization**: Admin
- **Request Body**: CreateDeviceDto
- **Response**: DeviceResponseDto (201)

#### GET /devices

- **Purpose**: List devices in the caller's org, paginated
- **Method**: GET
- **Authorization**: Admin
- **Query Parameters**: `search?`, `page`, `limit`, `connectionId?`, `type?` (METER/TANK), `unassigned?` (boolean — takes precedence over `connectionId` if both given)
- **Response**: `{ data: DeviceResponseDto[], meta }`

#### GET /devices/:id

- **Purpose**: Get a device by id
- **Method**: GET
- **Authorization**: Admin, or the owning Customer
- **Response**: DeviceResponseDto (404 for a non-owned device, same as a nonexistent id)

#### PATCH /devices/:id

- **Purpose**: Rename, activate/deactivate, or (re)assign/unassign a device
- **Method**: PATCH
- **Authorization**: Admin
- **Request Body**: UpdateDeviceDto (`connectionId: null` unassigns, a number reassigns, omit leaves untouched)
- **Response**: DeviceResponseDto

#### DELETE /devices/:id

- **Purpose**: Soft-delete a device
- **Method**: DELETE
- **Authorization**: Admin
- **Response**: 204 No Content

#### GET /devices/:id/telemetry

- **Purpose**: Consumption view — telemetry readings over a time window
- **Method**: GET
- **Authorization**: Admin, or the owning Customer
- **Query Parameters**: `range?` (`1d`\|`7d`\|`30d`\|`custom`), `from?`, `to?` (required together when `range=custom`), `paramKey?`, `page` (default 1), `limit` (default 100, max 500)
- **Response**: `{ data: TelemetryReadingDto[], meta }`
- **Errors**: 400 if `range=custom` without both `from`/`to`, if `from` > `to`, or if `paramKey` doesn't belong to this device's type

#### GET /accounts/me/devices

- **Purpose**: List the caller's own devices
- **Method**: GET
- **Authorization**: Customer
- **Response**: `DeviceResponseDto[]` (no pagination — a customer's own device count is inherently small and bounded)

### Device Types

#### GET /device-types

- **Purpose**: List device types configured for the org (mostly seed data)
- **Method**: GET
- **Authorization**: any authenticated role
- **Response**: `DeviceTypeResponseDto[]`

### Pricing Configs

#### POST /pricing-configs

- **Purpose**: Create a FIXED or SLAB pricing config for a billed device type
- **Method**: POST
- **Authorization**: Admin
- **Request Body**: CreatePricingConfigDto
- **Response**: PricingConfigResponseDto (201)
- **Notes**: Auto-closes the previously active config for the same device type. Rejects a device type that isn't billed (400) or doesn't exist (404). SLAB structure is validated: first tier starts at 0, tiers are contiguous, only the last may be unbounded.

#### GET /pricing-configs

- **Purpose**: List pricing configs (active and superseded), paginated
- **Method**: GET
- **Authorization**: Admin
- **Query Parameters**: `page`, `limit`, `type?`
- **Response**: `{ data: PricingConfigResponseDto[], meta }`

#### GET /pricing-configs/active

- **Purpose**: Get the currently active config for a device type
- **Method**: GET
- **Authorization**: Admin
- **Query Parameters**: `type` (required)
- **Response**: PricingConfigResponseDto (404 if no active config)

### Invoices

#### POST /invoices/generate

- **Purpose**: Admin-triggered batch invoice generation
- **Method**: POST
- **Authorization**: Admin
- **Request Body**: GenerateInvoicesDto (both fields optional; defaults to the previous calendar month)
- **Response**: GenerateInvoicesResultDto — `{ billingPeriodStart, billingPeriodEnd, generated, skipped: [{deviceId, reason}] }`
- **Notes**: Never scheduled — this is the only entry point (per FR). Safe to call repeatedly; already-invoiced device+period pairs are silently skipped, not duplicated or errored.

#### GET /invoices

- **Purpose**: List all invoices in the org, paginated
- **Method**: GET
- **Authorization**: Admin
- **Query Parameters**: `search?` (serialNo), `page`, `limit`, `deviceId?`, `status?`, `billingPeriodStart?`, `billingPeriodEnd?` (exact-match period lookup)
- **Response**: `{ data: InvoiceResponseDto[], meta }`

#### GET /invoices/:id

- **Purpose**: Get an invoice by id
- **Method**: GET
- **Authorization**: Admin, or the owning Customer
- **Response**: InvoiceResponseDto

#### PATCH /invoices/:id/cancel

- **Purpose**: Cancel a non-PAID invoice (correction flow)
- **Method**: PATCH
- **Authorization**: Admin
- **Response**: InvoiceResponseDto
- **Errors**: 400 if the invoice is already PAID

#### GET /accounts/me/invoices

- **Purpose**: List the caller's own invoices, paginated
- **Method**: GET
- **Authorization**: Customer
- **Query Parameters**: `search?`, `page`, `limit`, `status?`
- **Response**: `{ data: InvoiceResponseDto[], meta }`

### Payments (Appreciated)

#### POST /invoices/:id/pay

- **Purpose**: Initiate a payment session for a PENDING invoice
- **Method**: POST
- **Authorization**: Customer (must own the invoice)
- **Response**: PaymentSessionResponseDto — `{ transactionId, provider, providerTransactionId, amount, checkoutUrl }`
- **Errors**: 400 if the invoice is not PENDING, 404 if not found/not owned
- **Notes**: `checkoutUrl` is a placeholder — this is a mock gateway, there is no real hosted checkout page. The invoice only reaches PAID via the webhook below.

#### GET /invoices/:id/payments

- **Purpose**: View payment attempt history for an invoice
- **Method**: GET
- **Authorization**: Admin, or the owning Customer
- **Response**: `PaymentTransactionResponseDto[]`

### Payment Webhook (no JWT)

#### POST /payments/v1/webhook/:provider

- **Purpose**: Payment provider's webhook ingress — inserts/updates the payment transaction and, on success, marks the invoice PAID
- **Method**: POST
- **Authentication**: `PaymentSignatureGuard` (HMAC signature over the raw body, timing-safe compare) — not JWT
- **Path**: literal, version-neutral (`payments/v1/webhook/:provider`, not under `/api` or `/v1`)
- **Parameters**: `provider` (path)
- **Request Body**: PaymentWebhookDto
- **Response**: 204 No Content
- **Notes**: Idempotent — a retried webhook for an already-PAID invoice or an unrecognized transaction id is acknowledged (204), not errored, since providers retry undelivered/unrecognized webhooks.

## Request DTOs

### CreateUserDto

| Field       | Type     | Required | Description                    |
| ------------ | ---------| ---------- | ---------------------------------|
| firstName   | string   | Yes      | First name                     |
| lastName    | string   | No       | Last name                      |
| email       | string   | Yes      | Must be a valid email, globally unique |
| password    | string   | Yes      | Min 8 characters                |
| phoneNumber | string   | Yes      | 7-15 digits                     |
| address     | string   | Yes      | —                               |
| pincode     | string   | Yes      | 4-10 digits                     |
| roleType    | enum     | Yes      | `Admin` \| `Customer`           |

### UpdateUserDto

All fields optional, same constraints as CreateUserDto minus `email`/`password`/`roleType` (excluded — those need dedicated flows, not a generic PATCH): `firstName`, `lastName`, `phoneNumber`, `address`, `pincode`, `isActive`.

### CreateAccountDto

| Field  | Type | Required | Description                     |
| -------| -----| ---------| -----------------------------------|
| userId | int  | Yes      | Must be a Customer-role user without an existing account |

### UpdateAccountStatusDto

| Field  | Type | Required | Description               |
| -------| -----| ---------| -----------------------------|
| status | enum | Yes      | `ACTIVE` \| `SUSPENDED`   |

### CreateDeviceDto

| Field        | Type | Required | Description                                  |
| -------------| -----| ---------| ------------------------------------------------|
| name         | string | Yes    | —                                             |
| type         | enum  | Yes     | `METER` \| `TANK`                             |
| connectionId | int   | No      | Omit to add to inventory unassigned            |

### UpdateDeviceDto

| Field        | Type          | Required | Description                                            |
| -------------| ---------------| ---------| ----------------------------------------------------------|
| name         | string        | No       | —                                                       |
| isActive     | boolean       | No       | —                                                       |
| connectionId | int \| null   | No       | `null` unassigns, a number (re)assigns, omit leaves untouched |

`type` is deliberately excluded — a device's physical type shouldn't change after creation; telemetry validation depends on it.

### CreatePricingConfigDto

| Field         | Type                    | Required                | Description                          |
| --------------| --------------------------| --------------------------| -----------------------------------------|
| type          | enum                    | Yes                    | `METER` \| `TANK`                    |
| rateType      | enum                    | Yes                    | `FIXED` \| `SLAB`                    |
| fixedRate     | number (positive)       | If rateType=FIXED      | Rate per consumption unit             |
| slabs         | CreatePricingSlabDto[]  | If rateType=SLAB       | Tier definitions, min 1                |
| effectiveFrom | ISO8601 string          | No                      | Omit to start now                      |

### CreatePricingSlabDto

| Field    | Type              | Required | Description                                   |
| ---------| -------------------| ----------| --------------------------------------------------|
| slabFrom | number (>= 0)     | Yes      | Inclusive lower bound                          |
| slabTo   | number (positive) | Only on non-last tiers | Omit only on the last, unbounded tier |
| rate     | number (positive) | Yes      | Per-unit rate for this tier                    |

### GenerateInvoicesDto

| Field              | Type            | Required | Description                                              |
| --------------------| ------------------| ----------| --------------------------------------------------------------|
| billingPeriodStart | ISO8601 string  | No       | Must be provided together with billingPeriodEnd, or neither |
| billingPeriodEnd   | ISO8601 string  | No       | Omit both to default to the previous calendar month       |

### PaymentWebhookDto

| Field                | Type   | Required | Description                              |
| ----------------------| --------| ----------| ---------------------------------------------|
| providerTransactionId | string | Yes      | Matched against `payment_transaction.providerTransactionId` |
| status                | enum   | Yes      | `SUCCESS` \| `FAILED`                    |

### LoginDto

| Field    | Type   | Required | Description             |
| ---------| --------| ----------| ---------------------------|
| email    | string | Yes      | Valid email format      |
| password | string | Yes      | Min 8 characters        |

## Response Shapes

### UserResponseDto

`{ id, firstName, lastName, isActive, email, phoneNumber, address, pincode, roleType, createdAt, updatedAt }` — never includes `passwordHash`.

### AccountResponseDto

`{ id, accountNo, status, user: { id, firstName, lastName, email }, createdAt, updatedAt }`

### DeviceResponseDto

`{ id, name, serialNo, type, isActive, connection: { id, accountNo } | null, createdAt, updatedAt }`

### DeviceTypeResponseDto

`{ id, type, billed }`

### PricingConfigResponseDto

`{ id, type, rateType, fixedRate, slabs: [{ slabFrom, slabTo, rate }], effectiveFrom, effectiveTo, createdAt }`

### InvoiceResponseDto

`{ id, serialNo, device: { id, name, serialNo }, billingPeriodStart, billingPeriodEnd, openingReading, closingReading, consumptionUnits, appliedUnitRate, amount, status, transactionId, transactionProvider, generatedAt, dueDate }`

### GenerateInvoicesResultDto

`{ billingPeriodStart, billingPeriodEnd, generated: number, skipped: [{ deviceId, reason }] }`

### TelemetryReadingDto

`{ paramKey, value, deviceTimestamp }` — trimmed to only what the consumption view renders, not the full telemetry row.

### PaymentSessionResponseDto

`{ transactionId, provider, providerTransactionId, amount, checkoutUrl }`

### PaymentTransactionResponseDto

`{ id, provider, providerTransactionId, amount, status, createdAt }`

## Pagination

Every paginated list endpoint shares the same shape:

- Request: `?page=1&limit=20` (limit max varies: 100 for most resources, 500 for telemetry)
- Response: `{ data: T[], meta: { page: number, limit: number, total: number } }`

## Response Codes

| Code | Description                          |
| ----- | ---------------------------------------|
| 200  | Success                              |
| 201  | Created successfully                 |
| 202  | Accepted (ingestion-service only — see its own api.md) |
| 204  | Success, no content (delete, webhook ack) |
| 400  | Bad request / validation error       |
| 401  | Unauthorized (missing/invalid JWT, bad credentials) |
| 404  | Resource not found (or not owned — never 403 for ownership) |
| 409  | Conflict (duplicate unique constraint) |
| 422  | Unprocessable (ingestion-service only — invalid paramKey for device type) |
| 500  | Internal server error (org misconfiguration — a setup bug, not a client error) |

## Error Response Shape

Every error response is normalized by the global exception filter:

```json
{
  "statusCode": 404,
  "message": "Device 123 not found",
  "error": "Not Found",
  "path": "/api/v1/devices/123",
  "timestamp": "2026-08-11T10:05:00.000Z"
}
```
