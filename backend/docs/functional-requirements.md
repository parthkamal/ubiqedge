# Functional Requirements

## Purpose

The backend manages the full lifecycle of an on-premise IoT water billing operation: authenticating Admin and Customer users, onboarding meters/tanks and linking them to customer billing accounts, exposing metered consumption for a chosen time window, computing monthly invoices from raw telemetry under either a fixed or slab pricing model, and (as an appreciated/stretch capability) settling those invoices through a mock payment gateway. Source requirements: `../../ubiqedge_fr`.

## Core Concepts

### Organization

The tenancy boundary. Every other row in the schema is scoped to exactly one organization (`orgId`), denormalized onto the row rather than resolved through joins, so every query can filter by tenant directly. `organization.id` is a human-readable code (e.g. `ORG01`) — it doubles as the `:orgCode` segment in the ingestion URI, not just a surrogate key. Organizations are seed-driven for this assignment's scope, not created/managed through the API (see `technical-specifications.md`).

### User

An Admin or a Customer. Roles are seeded per-organization (`role` table); there is no self-signup — Admin creates every user (per FR). `email` is globally unique across all organizations (not per-org), because login (`POST /auth/login`) takes only `{ email, password }` with no `orgCode`, so email alone must resolve unambiguously to one user.

### CustomerConnection (Account)

The FR's "account/connection" — a 1:1 relationship to a Customer user, holding a customer-facing `accountNo` and an `ACTIVE`/`SUSPENDED` status. Suspension is the hook the stretch "cut off supply on non-payment" feature would act on, though the physical relay control itself is out of scope for this build. An account can hold many devices (1:M).

### Device (Meter / Tank)

A physical water meter or level-sensor tank. `device.connectionId` is nullable by design — Admin can add a device to inventory before it's linked to any customer's account. `serialNo` is auto-generated from the device's own auto-increment id (e.g. `ORG01-METER-000001`) and is the identifier the ingestion URI and the device simulators address the device by.

### DeviceType / DeviceTypeParam

`device_type` distinguishes METER from TANK and carries a `billed` flag (METER=true, TANK=false) — a flag rather than a hardcoded type check, so billing eligibility is data-driven. `device_type_param` enumerates which telemetry parameters exist per org: METER devices report `TOTAL` (cumulative) and `FLOW` (instantaneous); TANK devices report `LEVEL`. `paramKey` is immutable once created.

### DeviceTelemetry

One row per reading per parameter per device. Carries both a `deviceTimestamp` (when the device took the reading) and a `serverTimestamp` (when the ingestion service received it) — the two can diverge under network delay/retry. This is the append-only stream the consumption view reads and invoice generation checkpoints against.

### PricingConfig / PricingSlab

The billing rate in effect for a device type, either `FIXED` (a flat rate per consumption unit) or `SLAB` (progressive tiers, each with its own rate, stored as child `pricing_slab` rows). Only one config may be active (`effectiveTo IS NULL`) per device type at a time; creating a new config auto-closes whatever was previously active, keeping coverage contiguous with no gap or overlap.

### CustomerInvoice

One row per device per billing period. Anchors its opening reading either to the closing reading of the device's last non-cancelled invoice, or — for a device's first-ever invoice — to its earliest recorded `TOTAL` reading. Stores a single blended `appliedUnitRate` even under slab pricing (not a line-item-per-tier breakdown), auditable back to the `pricingConfig` that produced it. Status is `PENDING` → `PAID` (via the payment webhook) or `PENDING`/`PAID` → `CANCELLED` (an admin correction flow for a bad invoice, e.g. one generated from a bad reading).

### PaymentTransaction

An attempt to pay an invoice through the (mocked) payment gateway. Multiple attempts can exist per invoice (`INITIATED` → `SUCCESS`/`FAILED`); the invoice only transitions to `PAID` on a `SUCCESS` webhook, processed idempotently.

## Functional Requirements

### 1. Authentication

1.1 The system must allow Admin and Customer users to log in with `{ email, password }`.

1.2 The system must issue a JWT access token on successful login, carrying the user's id, organization, and role.

1.3 The system must reject login with a single generic "Invalid credentials" message regardless of whether the email doesn't exist, the account is deactivated, or the password is wrong — so a caller can never use the error to learn whether an email is registered.

1.4 The system must not support self-registration — only an Admin can create users.

1.5 The system must not implement a refresh-token flow (documented limitation — access-token-only, fixed expiry).

1.6 The system must not implement a forgot-password flow (documented limitation — no email-sending capability in this stack; Admin can still manage all users directly).

### 2. User Management

2.1 The system must allow Admin to create a user with role Admin or Customer.

2.2 The system must allow Admin to list users, paginated and filterable by role, searchable by name/email.

2.3 The system must allow any authenticated user to view their own profile.

2.4 The system must allow Admin to view, update, and soft-delete any user in their organization.

2.5 The system must scope every user operation to the caller's organization; a user from a different org must 404, not 403 (existence is never confirmed cross-tenant).

### 3. Account (Connection) Management

3.1 The system must allow Admin to create an account, linking exactly one Customer user (1:1).

3.2 The system must reject creating a second account for a user who already has one.

3.3 The system must reject creating an account for a non-Customer user.

3.4 The system must allow Admin to list, paginated and searchable, and to view accounts by id.

3.5 The system must allow a Customer to view their own account.

3.6 The system must allow Admin to change an account's status between `ACTIVE` and `SUSPENDED`.

### 4. Device (Meter/Tank) Management

4.1 The system must allow Admin to create a water meter or tank, optionally linking it to an account at creation time.

4.2 The system must allow a device to exist unassigned (in inventory, `connectionId IS NULL`) before being linked to an account.

4.3 The system must auto-generate a unique `serialNo` per device from its own database id.

4.4 The system must allow Admin to list devices, paginated, filterable by account, device type, and unassigned status, and searchable by name/serial number.

4.5 The system must allow Admin, or the Customer who owns the device, to view a device by id — a non-owning Customer must 404, not 403.

4.6 The system must allow Admin to rename, activate/deactivate, (re)assign, or unassign a device.

4.7 The system must allow Admin to soft-delete a device.

4.8 The system must allow a Customer to list their own devices.

### 5. Consumption View (Telemetry Query)

5.1 The system must allow Admin, or the owning Customer, to view a device's telemetry readings over a chosen time window.

5.2 The system must support preset time windows: last 1 day, last 7 days, last 30 days.

5.3 The system must support a custom time window via explicit `from`/`to` timestamps.

5.4 The system must support filtering readings by parameter (e.g. only `TOTAL`, only `LEVEL`).

5.5 The system must reject a custom range where `from` is after `to`.

5.6 The system must limit the response to only the columns the consumption view needs (paramKey, value, deviceTimestamp) — not the full telemetry row shape.

5.7 The system must paginate telemetry results to bound response size.

### 6. Data Ingestion (see also `ingestion-service/docs/functional-requirements.md`)

6.1 The backend's device/device-type/device-type-param data is the source of truth the ingestion service validates incoming readings against — no ingestion logic lives in the backend itself; see the sibling service's documentation.

### 7. Pricing Configuration

7.1 The system must allow Admin to configure a `FIXED` per-unit rate for a billed device type.

7.2 The system must allow Admin to configure a `SLAB` (progressive tier) rate structure for a billed device type.

7.3 The system must validate slab structure: the first tier must start at 0, tiers must be contiguous with no gaps or overlaps, and only the last tier may be unbounded (omit an upper bound).

7.4 The system must reject a pricing config for a device type that is not billed (e.g. TANK).

7.5 The system must automatically close (`effectiveTo`) the previously active config for a device type when a new one is created, so coverage stays contiguous.

7.6 The system must allow Admin to list pricing configs (active and superseded) and to fetch the currently active one for a device type.

### 8. Invoice Generation

8.1 The system must generate invoices only via an explicit Admin-triggered action (`POST /invoices/generate`) — never on an automatic schedule (per FR: "Admin can generate invoices for all meters for previous month").

8.2 The system must default to the previous calendar month when no explicit billing period is given, and accept an explicit period for backfills/reruns.

8.3 The system must generate one invoice per billed, active, account-linked device per billing period.

8.4 The system must anchor each invoice's opening reading to the closing checkpoint of that device's last non-cancelled invoice, or to the device's earliest recorded `TOTAL` reading if this is its first invoice.

8.5 The system must anchor each invoice's closing reading to the latest `TOTAL` reading at or before the period end.

8.6 The system must skip (not fail the batch for) a device with no telemetry recorded yet, no new telemetry since its last invoice, negative computed consumption (meter reset/replacement), or no active pricing config for its device type — logging the reason per device.

8.7 The system must compute the invoice amount under `FIXED` pricing as `consumptionUnits * fixedRate`.

8.8 The system must compute the invoice amount under `SLAB` pricing by walking tiers in order, and store a single blended `appliedUnitRate` (`amount / consumptionUnits`).

8.9 The system must be safe to call more than once for the same period — an already-invoiced device+period is a no-op, not a duplicate or an error (idempotent via a unique constraint).

8.10 The system must allow Admin to list all invoices (filterable by device, status, period) and view any invoice by id.

8.11 The system must allow Admin, or the owning Customer, to view a specific invoice.

8.12 The system must allow a Customer to list their own current and previous invoices.

8.13 The system must allow Admin to cancel a `PENDING` invoice (correction flow for a bad reading/generation) but must reject cancelling an already-`PAID` invoice.

### 9. Payment (Appreciated)

9.1 The system must allow a Customer to initiate a payment session for their own `PENDING` invoice.

9.2 The system must reject initiating payment for a non-`PENDING` invoice, or for an invoice the caller does not own.

9.3 The system must record every payment attempt (`payment_transaction`) regardless of outcome, for audit purposes.

9.4 The system must accept a signed webhook from the payment provider and, on `SUCCESS`, mark the invoice `PAID` inside one transaction.

9.5 The system must process a retried/duplicate webhook idempotently — an already-`PAID` invoice must not be re-processed or have its transaction reference overwritten.

9.6 The system must not throw on a webhook for an unrecognized transaction — acknowledge and log it, since providers retry unrecognized webhooks.

9.7 The system must allow Admin, or the owning Customer, to view the payment attempt history for an invoice.

### 10. Access Control

10.1 The system must enforce JWT authentication on every endpoint except login and the payment webhook.

10.2 The system must enforce role-based access (`Admin`/`Customer`) per endpoint via a global guard, opted out explicitly per-route.

10.3 The system must enforce "Admin or the owning Customer" ownership checks inside the service layer (not the guard) for endpoints both roles can reach, returning 404 rather than 403 for a non-owned resource.

10.4 The system must never trust a client-supplied `orgId` or `userId` — every scoping decision uses the identity decoded from the JWT.

### 11. Data Isolation

11.1 The system must scope every list/detail query by the caller's organization.

11.2 The system must treat a resource that exists but belongs to a different organization identically to a resource that doesn't exist at all (404, not 403).

## Lifecycle Requirements

### Device Lifecycle

- **Creation**: Admin creates a device, optionally unassigned.
- **Assignment**: Admin links/relinks the device to an account, or unassigns it (`connectionId = null`).
- **Deactivation**: Admin can mark the device inactive without removing it.
- **Soft deletion**: Admin can soft-delete; telemetry/invoice history is preserved for audit, but the device stops accepting new telemetry (ingestion service excludes soft-deleted devices).

### Pricing Config Lifecycle

- **Creation**: Admin creates a config for a device type; any previously active config for that type is auto-closed at the new config's `effectiveFrom`.
- **No update/delete**: configs are immutable once created — the only way to change a rate is to create a new config, preserving full pricing history for audit against past invoices.

### Invoice Lifecycle

- **Generation**: created only by an admin-triggered batch run, `PENDING` on creation.
- **Payment**: transitions `PENDING` → `PAID` on a successful payment webhook.
- **Cancellation**: Admin may transition `PENDING` → `CANCELLED`; `PAID` invoices cannot be cancelled. A cancelled invoice is excluded from the next invoice's opening-checkpoint anchor query, so cancelling doesn't corrupt future billing continuity.

## Validation Requirements

### Mandatory Fields (creation)

- User: firstName, email, password (min 8 chars), phoneNumber (7-15 digits), address, pincode (4-10 digits), roleType
- Account: userId
- Device: name, type
- PricingConfig: type, rateType, and either fixedRate (FIXED) or slabs (SLAB)
- Invoice generation: none (both period bounds optional, default to previous month)

### Conditional Requirements

- `billingPeriodStart`/`billingPeriodEnd` must be provided together, or not at all.
- SLAB pricing requires `slabs`; FIXED pricing requires `fixedRate`.
- `range=custom` on the telemetry query requires both `from` and `to`.

### Uniqueness Requirements

- `user.email` is globally unique (not per-org).
- `customer_connection.userId` is unique (1:1 user:account).
- `customer_connection.accountNo`, `device.serialNo`, `customer_invoice.serialNo` are unique per org.
- `device_type.type`, `role.type`, `device_type_param.paramKey` are unique per org.
- `customer_invoice(deviceId, billingPeriodStart, billingPeriodEnd)` is unique — the idempotency guarantee for invoice generation.
- `payment_transaction(provider, providerTransactionId)` is unique — the idempotency guarantee for webhook processing.

## State Management Requirements

### CustomerConnection Status States

| State     | Entry Condition                | Exit Condition          |
| --------- | ------------------------------- | ------------------------ |
| ACTIVE    | Account created, or reactivated | Admin suspends           |
| SUSPENDED | Admin suspends (non-payment)    | Admin reactivates        |

### CustomerInvoice Status States

| State     | Entry Condition                        | Exit Condition                     |
| --------- | ---------------------------------------- | ------------------------------------ |
| PENDING   | Invoice generated                      | Payment success, or admin cancels  |
| PAID      | Payment webhook SUCCESS on a PENDING invoice | none (terminal)               |
| CANCELLED | Admin cancels a non-PAID invoice       | none (terminal)                    |

### PaymentTransaction Status States

| State     | Entry Condition                  | Exit Condition                  |
| --------- | ----------------------------------| ---------------------------------|
| INITIATED | Payment session created          | Webhook resolves SUCCESS/FAILED |
| SUCCESS   | Webhook reports success          | none (terminal)                 |
| FAILED    | Webhook reports failure          | none (terminal)                 |

## Reporting / Query Requirements

### Pagination

- `?page=&limit=` (default page=1, limit=20, max limit=100) → `{ data: [], meta: { page, limit, total } }`, consistently across every list endpoint.

### Search

- Case-insensitive partial match (`LIKE '%term%'`) on the user-facing identifying fields per resource: users (firstName/lastName/email), accounts (accountNo/firstName/lastName/email), devices (name/serialNo), invoices (serialNo).

### Filtering

- Devices: by account, device type, unassigned-only.
- Accounts: by exact `userId`.
- Pricing configs: by device type.
- Invoices: by device, status, exact billing period.
- Telemetry: by time-window preset or custom range, by parameter.
