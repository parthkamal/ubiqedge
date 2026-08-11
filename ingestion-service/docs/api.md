# API Reference

## Routes Overview

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/ingest/v1/:orgCode/:deviceType/:serialNo` | Ingest one or more telemetry readings for a device |

This service exposes exactly one route. All other functionality (device provisioning, account linkage, viewing telemetry) lives in `backend` — see `../../backend/docs/api.md`.

---

## POST /ingest/v1/:orgCode/:deviceType/:serialNo

**Purpose**: Accept a batch of parameter readings for one device at one timestamp, and persist them idempotently.

**Method**: `POST`

**Authentication**: `X-Api-Key` header, required. One key per organization (see `implementation-spec.md` — `ApiKeyGuard`).

**Authorization**: None beyond the API key — this service has no user/role concept. The key itself scopes the request to the organization identified by `:orgCode`.

### Path Parameters

| Parameter | Type | Notes |
| --------- | ---- | ----- |
| `orgCode` | string | Organization code, e.g. `ORG01`. Must match the org the API key belongs to. |
| `deviceType` | string | `METER` or `TANK`. Must match the resolved device's actual type. |
| `serialNo` | string | The device's serial number, unique within the organization. |

### Request Body

```json
{
  "deviceTimestamp": "2026-08-11T10:30:00.000Z",
  "readings": [
    { "paramKey": "TOTAL", "value": 1234.56 },
    { "paramKey": "FLOW", "value": 2.3 }
  ]
}
```

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `deviceTimestamp` | string (ISO 8601) | Yes | The device's own reading timestamp |
| `readings` | array | Yes | At least 1 entry |
| `readings[].paramKey` | string enum | Yes | `TOTAL`, `FLOW` (meters) or `LEVEL` (tanks) — must be configured for the resolved device's type |
| `readings[].value` | number | Yes | The reading value |

A meter typically sends `TOTAL` and `FLOW` together in one request; a tank sends `LEVEL` alone. Nothing in the endpoint enforces sending all of a device type's parameters together — a request with a subset of valid `paramKey`s is accepted.

### Response

**202 Accepted** — empty body. Returned both when new rows are written and when the request is a duplicate of previously-ingested readings (idempotent no-op).

### Errors

| Status | Condition |
| ------ | --------- |
| 400 | `deviceTimestamp` missing/not ISO 8601, or `readings` missing/empty/malformed |
| 401 | Missing/invalid `X-Api-Key`, or `:orgCode` does not resolve to an organization |
| 404 | `:serialNo` does not resolve to a device in the organization, or `:deviceType` does not match the device's actual type |
| 409 | Device exists but is not linked to a customer account (`connectionId IS NULL`) |
| 422 | One or more `readings[].paramKey` values are not configured for the device's type |
| 500 | Unhandled error |

See `technical-specifications.md` for the exact validation order (API key → device resolution → type match → linkage → per-reading paramKey validation → insert).

## Response Codes

| Code | Meaning | Used for |
| ---- | ------- | -------- |
| 202 | Accepted | Successful ingestion, including absorbed duplicates |
| 400 | Bad Request | Malformed body |
| 401 | Unauthorized | API key / org resolution failure |
| 404 | Not Found | Unknown device / type mismatch |
| 409 | Conflict | Unassigned device |
| 422 | Unprocessable Entity | Invalid `paramKey` for device type |
| 500 | Internal Server Error | Unhandled error |

## Error Response Shape

Produced by `AllExceptionsFilter`, matching `backend`'s error shape (see `../../backend/docs/api.md`):

```json
{
  "statusCode": 422,
  "message": "paramKey 'LEVEL' is not configured for device type METER",
  "error": "Unprocessable Entity",
  "timestamp": "2026-08-11T10:30:00.123Z",
  "path": "/ingest/v1/ORG01/METER/MTR-00042"
}
```
