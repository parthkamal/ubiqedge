# Functional Requirements

## Purpose

`ingestion-service` accepts telemetry readings pushed by physical (or, for this build, simulated) water meters and level-sensor tanks, at a 5-minute cadence, and persists them durably and idempotently for the consumption view and invoice generation to consume. Source: `../../ubiqedge_fr` requirement #5 ("data ingestion mechanism for water meter data (rest api), frequency of calling is 5 min").

## Core Concepts

### Ingestion Request

One HTTP call per device per reading interval, identifying the device by `(orgCode, deviceType, serialNo)` in the URL path, carrying one or more parameter readings for a single `deviceTimestamp` in the body. A meter sends `TOTAL` (cumulative) and `FLOW` (instantaneous) together; a tank sends `LEVEL` alone.

### Device Resolution

The `(orgCode, deviceType, serialNo)` triple must resolve to exactly one existing, non-soft-deleted `device` row in `backend`'s schema, whose actual type matches the `deviceType` path segment. This service does not create devices — device provisioning is exclusively a `backend` (Admin) responsibility.

### Linkage Gate

A device that exists in inventory but has not yet been linked to a customer account (`connectionId IS NULL`) must not have its readings persisted — this is rejected loudly (409), not silently accepted, so a forgotten assignment is visible immediately during testing/demo rather than discovered as a billing gap later.

### Idempotent Delivery

A retried or duplicate delivery for the same `(orgId, deviceId, deviceTypeParamId, deviceTimestamp)` must be absorbed without error and without creating a second row — the caller (a real device retrying after a dropped response, or the demo simulators) cannot always know whether a prior attempt succeeded.

## Functional Requirements

### 1. Telemetry Ingestion

1.1 The system must accept telemetry via `POST /ingest/v1/:orgCode/:deviceType/:serialNo`.

1.2 The system must accept one or more readings per request, each with a `paramKey` and a numeric `value`, sharing one `deviceTimestamp`.

1.3 The system must support the meter parameter set (`TOTAL`, `FLOW`) and the tank parameter set (`LEVEL`).

1.4 The system must resolve the target device from the URL path's `orgCode` + `deviceType` + `serialNo`, not from the request body.

1.5 The system must reject a request whose `serialNo` does not resolve to an existing device in that org (404).

1.6 The system must reject a request whose `deviceType` path segment does not match the resolved device's actual type (404 — treated identically to "device not found", not a separate error, so device existence isn't leaked across type).

1.7 The system must reject a request for a device not yet linked to a customer account (409), distinctly from "not found".

1.8 The system must reject a reading whose `paramKey` is not configured for the resolved device's type (422).

1.9 The system must validate every reading's `paramKey` before writing any of them — a request with one bad key among several must persist none of them, not a partial set.

1.10 The system must reject a request with a missing or invalid `deviceTimestamp` (400).

1.11 The system must record both the device-reported `deviceTimestamp` and the server-side receipt time (`serverTimestamp`) for every reading.

1.12 The system must accept a retried/duplicate delivery idempotently — the same reading delivered twice must not error and must not create a second row.

1.13 The system must proceed with ingestion regardless of the linked account's status (`ACTIVE` or `SUSPENDED`) — a suspended (non-paying) account's consumption is still metered; only a physical supply cutoff (stretch scope, not built) would affect the readings themselves, not whether they're recorded.

### 2. Authentication

2.1 The system must require a valid `X-Api-Key` header on every request.

2.2 The system must authenticate at the organization level — one shared key per org (`:orgCode`), not per device.

2.3 The system must reject a request with a missing, malformed, or incorrect key with the same generic 401, not distinguishing "unknown org" from "wrong key".

2.4 The system must compare the provided key using a timing-safe comparison, not a direct string/buffer equality check.

### 3. Data Isolation

3.1 The system must scope device and parameter resolution to the organization identified by the URL's `:orgCode` — never trust an org id from the request body.

## Lifecycle Requirements

### Ingestion Request Lifecycle

- **Receipt**: request arrives, API key validated first (before any device/body validation).
- **Resolution**: device resolved and validated (existence, type match, account linkage).
- **Validation**: every reading's `paramKey` resolved and validated before any write.
- **Persistence**: one `device_telemetry` row inserted per reading, or silently absorbed if it's a duplicate of an already-persisted reading.
- **Response**: `202 Accepted` on success (including the absorbed-duplicate case) — ingestion is fire-and-forget from the device's perspective, not a synchronous confirmation of a new row.

## Validation Requirements

### Mandatory Fields

- `deviceTimestamp` (ISO 8601), `readings` (array, minimum 1 entry, each with `paramKey` and numeric `value`)

### Conditional Requirements

- Every `paramKey` in `readings` must belong to the resolved device's `deviceTypeId` (validated per-reading, all-or-nothing before any write).

### Uniqueness / Idempotency

- `(orgId, deviceId, deviceTypeParamId, deviceTimestamp)` — enforced by the same unique constraint `backend` defines on `device_telemetry`; a duplicate-key error on insert is caught and treated as success, not surfaced as a client or server error.

## Non-Functional Requirements (see `technical-specifications.md` for detail)

- **Load profile**: steady, not spiky — a fixed device count × one call per 5 minutes averages to roughly 1 req/sec even at the FR's "300+ meters" large-scale tier.
- **Reliability over throughput**: horizontally replicable behind a load balancer without coordination, since the service is stateless and writes are idempotent.
- **Independent scaling**: isolated from `backend` specifically so an ingestion spike or outage cannot degrade the admin/customer-facing API, and vice versa.
