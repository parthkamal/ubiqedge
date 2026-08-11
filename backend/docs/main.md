# Backend Documentation

This document is the entry point for the `backend` service documentation. It links to the other documentation files describing this service's functional requirements, architecture, APIs, data model, and implementation details.

## Documentation Files

| File                                                         | Purpose                                                                |
| -------------------------------------------------------------| ----------------------------------------------------------------------|
| [functional-requirements.md](./functional-requirements.md)   | Business requirements, functional behavior, and operational rules     |
| [technical-specifications.md](./technical-specifications.md) | System architecture, module design, and processing flows              |
| [api.md](./api.md)                                            | Externally exposed RESTful APIs and endpoints (`/api/v1`, `/payments/v1`) |
| [db-tables.md](./db-tables.md)                                | Database entities, tables, constraints, and relationships             |
| [implementation-spec.md](./implementation-spec.md)            | Source-code implementation details and development guidance           |

## Service Overview

`backend` is the primary NestJS service for the ubiqedge on-premise IoT water billing system. It owns everything except the high-frequency device telemetry write path, which is intentionally split out into the sibling `ingestion-service` (see `ingestion-service/docs/main.md`) for independent scaling and hardening.

- **Source Location**: `src/`
- **Primary Responsibilities**: authentication, user/account/device management, telemetry querying (consumption view), pricing configuration, admin-triggered invoice generation, mock payment gateway + webhook ingress
- **Framework**: NestJS 11 + TypeScript
- **Database**: MySQL 8 (via TypeORM 0.3, migrations-only — no `synchronize`)
- **Sibling services**: `ingestion-service` (telemetry writes), `frontend` (React), `meter-simulator`/`tank-simulator` (device simulators), `seed` (Python bootstrap script)

## Quick Reference

| Resource        | File                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------|
| Core Entities    | `db-tables.md` — organization, role, user, customer_connection, device_type, device_type_param, device, device_telemetry, pricing_config, pricing_slab, customer_invoice, payment_transaction |
| Core Modules     | `technical-specifications.md` — AuthModule, UserModule, AccountModule, DeviceModule, TelemetryModule, PricingModule, InvoiceModule, PaymentModule, OrganizationModule |
| Core Services    | `implementation-spec.md` — AuthService, UserService, AccountService, DeviceService, TelemetryService, PricingService, InvoiceService, PaymentService |
| Key DTOs         | `api.md` — CreateUserDto, CreateDeviceDto, CreateAccountDto, CreatePricingConfigDto, GenerateInvoicesDto, PaymentWebhookDto |
| REST Endpoints   | `api.md` — 30 endpoints across `/api/v1` and `/payments/v1`                                              |
| Unit Tests       | 144 tests across 9 spec files, mocked Repository/DataSource only — see `implementation-spec.md` §Testing |

- **Requirements source**: `../../ubiqedge_fr` (plain-text FR), `../../ubiqedge_tech_data_model`, `../../ubiqedge_tech_api_design`, `../../ubiqedge_tech_implementation_spec` (design docs, kept current as the build progressed — treated as source of truth alongside this generated documentation)
