# Architecture Overview

This document serves as a critical, living template designed to equip agents with a rapid and comprehensive understanding of the codebase's architecture, enabling efficient navigation and effective contribution from day one. Update this document as the codebase evolves.

## 1. Project Structure

```
keiri/
├── apps/
│   ├── api/                    # Rust Axum REST API server (thin routing layer)
│   │   ├── src/
│   │   │   ├── main.rs         # Entry point: Core::init, migrations, worker spawn, bind :7878
│   │   │   ├── routes/         # Route handlers delegating to keiri_core
│   │   │   ├── middleware/     # Error types, metrics, per-user rate limiting
│   │   │   ├── extractors.rs   # ValidatedJson<T> request validation
│   │   │   └── background_tasks.rs  # BulkConfirmOcrJobHandler
│   │   └── Cargo.toml
│   └── dashboard/              # TanStack Start / React 19 SPA
│       ├── app/
│       │   ├── routes/         # File-based routing (/, /transactions, /settings)
│       │   ├── components/     # auth/, layout/, dashboard/, transactions/
│       │   ├── hooks/          # useEntityForm, useTransactions, useDemoData
│       │   └── lib/            # ApiClient, QueryKeys, auth-client, OPFS/wa-sqlite
│       └── package.json
├── crates/
│   ├── keiri_core/            # Central Hub ("Brain") — orchestrates all domain crates
│   │   └── src/
│   │       ├── lib.rs          # Core struct: Arc<DB>, Auth, S3, OCR + 10 domain managers
│   │       └── services/       # demo.rs, ocr.rs (cross-crate orchestration)
│   ├── transactions/           # Transaction CRUD + atomic wallet rebalancing (ops.rs)
│   ├── wallets/                # Wallet CRUD + adjust_balance
│   ├── budgets/                # Budget CRUD + health/consumption engine
│   ├── groups/                 # Groups + P2P requests + ledger tabs + mirrored txns
│   ├── contacts/               # Address book + multi-identifier + phonetic merge
│   ├── categories/             # Category CRUD + system defaults
│   ├── subscriptions/          # Recurring payment detection (90-day heuristic)
│   ├── reconciliation/         # Bank statement fuzzy matching (weighted scoring)
│   ├── users/                  # User profile + UPI ID management
│   ├── ocr/                    # OCR pipeline: worker, Gemini client, strategies
│   ├── upload/                 # S3/R2 client: upload, presign, compress
│   ├── auth/                   # BetterAuth integration + custom PostgresAdapter
│   ├── db/                     # SeaORM entities (36 models), DTOs, enums — no logic
│   ├── migration/              # sea-orm-migration definitions (auto-run on startup)
│   ├── jobs/                   # Generic background job queue (Postgres LISTEN/NOTIFY)
│   └── wasm/                   # WebAssembly build target
├── packages/
│   ├── types/                  # Shared TypeScript types (auto-generated via ts-rs)
│   ├── ui/                     # Shared Shadcn component library (Tailwind CSS v4)
│   └── wasm/                   # WASM package for frontend
├── docs/                       # Architecture docs (core, api, auth, ocr, schema, etc.)
├── scripts/                    # Automation scripts (seed.py)
├── AGENTS.md                   # Agent-facing instructions
├── GEMINI.md                   # Gemini CLI mandates
├── ARCHITECTURE.md             # This document
├── Cargo.toml                  # Rust workspace root
├── package.json                # pnpm workspace root
└── pnpm-workspace.yaml         # Workspace member definitions
```

## 2. High-Level System Diagram

```
[Browser] <──HTTP──> [Dashboard (TanStack Start)]
                          │
                    credentials:include
                          │
                    [:7878 Axum API]
                     ┌────┴────┐
                     │ Middleware│  CORS, Compression, Governor, AuthSession
                     └────┬────┘
                          │
                   [Route Handlers]  ── thin delegation layer
                          │
                   [keiri_core::Core]  ── central orchestrator
                    ┌─────┼─────┬──────┬──────┐
                    │     │     │      │      │
              [Transactions] [OCR] [Groups] [Budgets] ... (10 domain managers)
                    │     │     │
                    │     │     └──> [Gemini AI API]
                    │     └──────> [Cloudflare R2 / S3]
                    │
              [WalletsManager]  ── atomic balance adjustment
                    │
              [PostgreSQL]  ── SeaORM + LISTEN/NOTIFY
```

## 3. Core Components

### 3.1. Frontend — Dashboard

**Description:** Modern React SPA for managing personal and group finances. Features OCR receipt scanning, real-time budget tracking, subscription detection, bank statement reconciliation, and P2P settlement flows. Local-first architecture via OPFS/wa-sqlite for sub-millisecond reads.

**Technologies:** React 19, TanStack Start, TanStack Router, TanStack Query, Zustand, Tailwind CSS v4, better-auth/react, @journeyapps/wa-sqlite, Vite

**Deployment:** Served independently (Vite dev server :3000), talks to API at :7878

### 3.2. Backend Services

#### 3.2.1. API Gateway (`apps/api`)

**Description:** Thin Axum routing layer that delegates all business logic to `keiri_core`. Handles authentication (AuthSession extractor), rate limiting (Governor + per-user token buckets), request validation (ValidatedJson), metrics (Prometheus), and background worker orchestration.

**Technologies:** Rust, Axum 0.8, tower-http, tower_governor, mimalloc, tokio

**Deployment:** Single binary on port 7878, auto-runs DB migrations on startup

#### 3.2.2. Core Hub (`crates/keiri_core`)

**Description:** The "Brain" — a `Core` struct holding `Arc<DatabaseConnection>`, Auth, S3 client, OCR manager, and 10 domain managers. Re-exports all domain crates so `apps/api` only depends on `keiri_core`. Implements `OcrProcessor` trait for cross-crate OCR orchestration.

**Technologies:** Rust, SeaORM, better-auth, aws-sdk-s3, tokio

#### 3.2.3. OCR Pipeline (`crates/ocr`)

**Description:** Background worker pool processing receipt images. Downloads from R2, classifies document type (GPAY vs GENERIC via strategy pattern), sends to Gemini 2.5 Flash for structured JSON extraction, auto-creates contacts from UPI IDs, and saves transactions atomically.

**Technologies:** Rust, reqwest, tokio::spawn, TaskTracker, Postgres LISTEN/NOTIFY, CancellationToken

#### 3.2.4. Background Jobs (`crates/jobs`)

**Description:** Generic job queue backed by PostgreSQL. WorkerPool with configurable concurrency (default 10 slots). Supports bulk operations like BulkConfirmOcrJob with `buffer_unordered(5)` parallelism.

**Technologies:** Rust, SeaORM, async-trait, Postgres LISTEN/NOTIFY

## 4. Data Stores

### 4.1. PostgreSQL (Primary)

**Type:** PostgreSQL (via SeaORM + SQLx)

**Purpose:** All persistent data — users, transactions, wallets, budgets, contacts, groups, OCR jobs, subscriptions, bank statements, background jobs.

**Key Tables:** `users`, `transactions`, `wallets`, `txn_parties`, `budgets`, `categories`, `contacts`, `contact_identifiers`, `contact_links`, `groups`, `user_groups`, `p2p_requests`, `p2p_transfers`, `ledger_tabs`, `ocr_jobs`, `purchases`, `purchase_items`, `subscriptions`, `subscription_charges`, `bank_statement_rows`, `statement_txn_matches`, `background_jobs`, `sessions`, `accounts`, `verifications`

**Connection Pool:** max 100, min 5, acquire timeout 3s, idle timeout 600s, 3 retry on connect failure

### 4.2. OPFS / wa-sqlite (Frontend Cache)

**Type:** SQLite over Origin Private File System (browser-local)

**Purpose:** Sub-millisecond local reads on the dashboard. Enables offline-first UX with TanStack Store integration.

### 4.3. Cloudflare R2

**Type:** S3-compatible object storage

**Purpose:** Receipt images, user avatars, uploaded files. Keys structured as `{user_id}/{uuid}-{filename}`.

## 5. External Integrations / APIs

| Service                     | Purpose                                                 | Integration                                               |
| --------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| **Google Gemini 2.5 Flash** | OCR structured extraction from receipt images           | REST API (`generativeLanguage` endpoint) via reqwest      |
| **Cloudflare R2**           | File storage (receipts, avatars)                        | AWS SDK S3 (force_path_style)                             |
| **BetterAuth**              | Authentication framework (JWT sessions, email/password) | Rust crate `better-auth 0.10` with custom PostgresAdapter |

## 6. Deployment & Infrastructure

**Cloud Provider:** Cloudflare (R2 storage), self-hosted API

**Key Services:** Cloudflare R2, PostgreSQL, Google Gemini API

**CI/CD Pipeline:** GitHub Actions (`.github/`)

**Monitoring:** Custom Prometheus-compatible `/metrics` endpoint with per-route latency histograms and status counters (DashMap + AtomicU64)

**Dev Environment:** Nix flakes (`flake.nix`), direnv (`.envrc`), Docker Compose (PostgreSQL)

## 7. Security Considerations

**Authentication:** BetterAuth with JWT session cookies (`better-auth.session_token`), email/password plugin, passkey stubs (WebAuthn)

**Authorization:** AuthSession Axum extractor on all protected routes; Group RBAC via `user_groups.role` (ADMIN/MEMBER)

**Rate Limiting:** Global IP-based (1 req/sec, burst 10 via Governor) + per-user token bucket for OCR/upload (10 rpm, burst 20)

**Data Protection:** IDOR prevention on file keys (user_id prefix validation), path traversal mitigation in upload (filename sanitization), CORS with explicit allowed origins, 10MB body limit

**Secrets:** SOPS encryption (`.sops.yaml`), `.env` gitignored, `secrets.env` for encrypted values

## 8. Development & Testing Environment

**Local Setup:** `pnpm install` → `cp .env.example .env` → `cargo run -p migration -- up` → `pnpm dev`

**Testing Frameworks:**

- Rust: `rstest` (unit + integration), `cargo test -p keiri_core --lib`
- Frontend: `vitest` (headless logic only, no UI E2E)

**Code Quality:**

- JS/TS: oxlint + oxfmt (`.oxlintrc.json`, `.oxfmtrc.json`)
- Rust: clippy (deny all + pedantic warn) + rustfmt
- Pre-commit hooks (`.pre-commit-config.yaml`)

**Package Managers:** pnpm 11.17 (JS/TS), cargo (Rust)

## 9. Future Considerations / Roadmap

- **Service consolidation:** Domain crate logic migrating from `crates/<domain>/` into `keiri_core/src/services/` for unified orchestration
- **Auth expansion:** TwoFactorOps, PasskeyOps, OrganizationOps, ApiKeyOps are stubbed in `crates/auth` — ready for implementation
- **Mobile app:** `apps/app` scripts exist in package.json (Capacitor/Expo target)

## 10. Project Identification

**Project Name:** Keiri

**Repository URL:** github.com/kiyors/keiri

**Primary Contact/Team:** Gaurav (kiyors)

**Date of Last Update:** 2026-07-31

## 11. Glossary / Acronyms

| Term             | Definition                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| **Core**         | The `keiri_core::Core` struct — central orchestrator holding all service managers                     |
| **Domain Crate** | A Rust crate under `crates/` implementing business logic for one domain (wallets, transactions, etc.) |
| **OCR**          | Optical Character Recognition — receipt scanning via Gemini AI                                        |
| **OPFS**         | Origin Private File System — browser API for local SQLite storage                                     |
| **P2P**          | Peer-to-peer — money requests and settlements between users                                           |
| **RBAC**         | Role-Based Access Control — ADMIN/MEMBER roles in groups                                              |
| **Smart Merge**  | Deduplication of OCR results against existing transactions                                            |
| **wa-sqlite**    | WebAssembly SQLite — runs SQLite in the browser via OPFS                                              |
| **ts-rs**        | Rust crate that generates TypeScript types from Rust structs                                          |
