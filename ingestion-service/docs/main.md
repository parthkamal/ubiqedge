# Ingestion Service Documentation

This document is the entry point for the `ingestion-service` documentation. It links to the other documentation files describing this service's functional requirements, architecture, API, data touched, and implementation details.

## Documentation Files

| File                                                         | Purpose                                                             |
| -------------------------------------------------------------| -------------------------------------------------------------------- |
| [functional-requirements.md](./functional-requirements.md)   | Business requirements for the telemetry ingestion write path        |
| [technical-specifications.md](./technical-specifications.md) | Architecture, scaling/reliability posture, processing flow          |
| [api.md](./api.md)                                            | The single externally exposed endpoint                              |
| [db-tables.md](./db-tables.md)                                | Tables this service reads/writes (owned by `backend`, not this service) |
| [implementation-spec.md](./implementation-spec.md)            | Source-code implementation details                                  |

## Service Overview

`ingestion-service` is a small, standalone NestJS service with exactly one job: accept device telemetry over REST and write it to `device_telemetry`. It is deliberately split out of `backend` — see `technical-specifications.md` — because it has a fundamentally different load/scaling profile (high-frequency, no JWT, no business logic beyond validate-and-write) from the admin/customer-facing CRUD API.

- **Source Location**: `src/`
- **Primary Responsibility**: `POST /ingest/v1/:orgCode/:deviceType/:serialNo`
- **Framework**: NestJS 11 + TypeScript
- **Database access**: raw `mysql2` connection pool — **no TypeORM, no entity classes** (a deliberate simplification for a service this small; see `technical-specifications.md`)
- **Auth**: org-level API key (`X-Api-Key` header), not JWT

## Quick Reference

| Resource       | File                                                                   |
| ---------------| ---------------------------------------------------------------------- |
| Core Service   | `implementation-spec.md` — IngestService                              |
| Core Guard     | `implementation-spec.md` — ApiKeyGuard                                |
| Tables touched | `db-tables.md` — organization, device, device_type, device_type_param, device_telemetry (all owned/migrated by `backend`) |
| The Endpoint   | `api.md` — `POST /ingest/v1/:orgCode/:deviceType/:serialNo`            |
| Unit Tests     | 15 tests across 2 spec files, 100% statement coverage on both `IngestService` and `ApiKeyGuard` |

- **Requirements source**: `../../ubiqedge_fr`, `../../ubiqedge_tech_data_model`, `../../ubiqedge_tech_api_design` §2, `../../ubiqedge_tech_implementation_spec` §0/§0a (kept current as the build progressed — treated as source of truth alongside this generated documentation)
- **Sibling documentation**: `../../backend/docs/main.md` — the service that owns the schema and everything else in the system
