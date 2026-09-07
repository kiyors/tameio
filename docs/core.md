# Keiri Core Hub (`crates/keiri_core`)

This document defines the architecture and implementation patterns of the **Keiri Core Hub**. As the "Brain" of the ecosystem, this crate orchestrates cross-crate services and ensures financial integrity.

> **Status — target vs. current.** This document describes the **target** architecture, where business logic is consolidated under `keiri_core/src/services/`. **Currently**, that logic lives in the domain crates (`crates/wallets`, `crates/transactions`, `crates/budgets`, `crates/subscriptions`, `crates/groups`, `crates/ocr`, …) and is surfaced through the `keiri_core` facade as `keiri_core::<domain>` (e.g. `keiri_core::budgets`, `keiri_core::ocr`). Where this doc says `keiri_core::services::<x>` or `src/services/`, read it as the goal; the working path today is `keiri_core::<x>`.

## 1. Architectural Role

`keiri_core` sits between the raw data layer (`crates/db`) and the interface layer (`apps/api`).

- **Logic Isolation**: No business rules (e.g., "how much a wallet balance should change") exist in the DB or API layers. They reside in the domain crates and are orchestrated/exposed here (target: consolidated under `src/services/`).
- **Service Orchestration**: It manages the lifecycle of the Database connection, Authentication adapter, S3/R2 storage clients, and the OCR microservice.
- **Unified Interface**: It re-exports essential types and crates so that the `api` app only needs to depend on `keiri_core` to function.

---

## 2. Centralized Orchestration (`Core` Struct)

The system is managed by a thread-safe, clonable `Core` struct.

### Initialization

```rust
let core = Core::init(config).await?;
```

This single call:

1.  Establishes the SeaORM connection pool.
2.  Initializes the `BetterAuth` engine.
3.  Configures the AWS S3 SDK for Cloudflare R2.
4.  Initializes the native Rust OCR background processor.
5.  Ensures system-level data (like default categories) is present in the database.

---

## 3. Service Structure (The "Granular" Rule)

Following strict maintainability standards, logic is broken down into small, specialized files. _Target:_ under `keiri_core/src/services/`. _Current:_ within the corresponding domain crate (e.g. `crates/transactions/src/`).

### Example: transactions (`crates/transactions/src/`; target `services/transactions/`)

- **`create.rs`**: Handles atomic insertion of transactions and their associated parties.
- **`update.rs`**: Manages state transitions and audit logs in `transaction_edits`.
- **`delete.rs`**: Implements soft-deletes and balance reversals.
- **`split.rs`**: Orchestrates P2P request generation for fractional payments.
- **`utils.rs`**: Internal helpers like `adjust_transaction_wallets` which ensure the ledger always matches the wallet balances.

---

## 4. Key "Bank Logic" Implementations

### Financial Integrity (Wallets)

Every ledger entry must be reflected in a physical wallet balance.

- **Atomic Transactions**: All balance adjustments happen inside SeaORM transactions (`db.transaction`).
- **Reversibility**: When a transaction is edited or deleted, the core automatically calculates the "delta" and applies the inverse operation to the wallet.

### Budget Health Calculation

Located in `crates/budgets`, surfaced via `keiri_core::budgets` (target: `keiri_core::services::budgets`):

- **Real-time Tracking**: Aggregates all `OUT` transactions within a specific `BudgetPeriod` (Weekly, Monthly, Yearly).
- **Category Granularity**: Supports both category-specific limits and "All Categories" global limits.
- **Velocity Metrics**: Calculates consumption percentage to drive proactive financial alerts in the UI.

### Subscription Detection

Located in `crates/subscriptions` (target: `services/subscriptions/detection.rs`), the core implements a heuristic algorithm that:

1.  Scans 90 days of history.
2.  Groups transactions by amount and vendor.
3.  Calculates day-variance to identify Weekly, Monthly, or Yearly cycles.
4.  Predicts the `next_charge_date`.

### OCR Orchestration

The core doesn't just "read text"; it orchestrates a pipeline natively in Rust (`crates/ocr`):

1.  Retrieves the file from R2.
2.  Processes it via the background worker using Postgres LISTEN/NOTIFY.
3.  **Auto-Contact Creation**: If the OCR identifies a new UPI ID, the core automatically creates a new `Contact` and links it to the user's address book before saving the transaction.

### P2P Mirroring & State Machine

Located in `crates/groups` and `crates/transactions`, surfaced via the `keiri_core` facade (target: `keiri_core::services::p2p`):

- **Mirrored Entries**: When a user accepts a P2P request, the core automatically generates an identical transaction for the recipient (with inverse direction).
- **Relational Integrity**: Transactions are linked to their originating `p2p_requests`, ensuring that settlement status is always accurately reflected across both users' ledgers.
- **Group RBAC**: All collaborative actions are validated against the `user_groups` role system, preventing unauthorized members from modifying shared financial history.

### Demo Onboarding Orchestration

Located in `crates/keiri_core/src/services/demo.rs`:

- **Atomic Seeding**: Generates realistic mock data spanning all primary entities (3 Wallets, 8 Categories, 3 Budgets, 4 Contacts, 20 Transactions) inside a single SeaORM transaction.
- **Atomic Teardown**: Reverts and clears all user data with relational integrity to provide users a fresh start.
- **Metadata Flagging**: Manages the `demo_active` boolean within the `users.metadata` JSONB column to persist exploration state for the frontend.

---

## 5. Dependency Management

To simplify the workspace, `keiri_core` re-exports common crates:

- `keiri_core::sea_orm`
- `keiri_core::better_auth`
- `keiri_core::auth`
- `keiri_core::upload`
- `keiri_core::budgets`

This allows the `api` routes to use `keiri_core` as a single source of truth for types and traits.
