# Keiri API Reference (`apps/api`)

This document covers the structure and available endpoints of the Keiri API gateway. It pairs with the [Database Schema Documentation](./database_schema.md) to provide a complete overview of how data flows from the UI to the **`keiri_core`** logic hub.

## Architectural Overview

- **Framework**: Rust with [`axum`](https://docs.rs/axum/latest/axum/).
- **Central Hub**: **`keiri_core`** handles all business logic, database connections, and service orchestration.
- **Authentication**: [`better-auth`] integrated via **`keiri_core`**.
- **Base URL**: `/api` (business logic) and `/api/auth` (authentication).
- **Security Protocol**: Endpoints are strictly guarded via the `AuthSession` extractor (re-exported by `keiri_core`).

### Application State (`AppState`)

The API maintains a lean state, delegating complexity to the core:

| Field  | Type               | Description                                             |
| ------ | ------------------ | ------------------------------------------------------- |
| `core` | `keiri_core::Core` | Unified instance managing DB, Auth, S3, and Native OCR. |

---

## 1. Transactions & Ledger

Managed by **`keiri_core::services::transactions`**.

### `GET /api/transactions`

- **Purpose**: Fetch paginated transactions.
- **Query Params**: `limit`, `offset`.
- **Response**: Array of `TransactionWithDetail` objects (includes wallet/contact names).

### `POST /api/transactions/manual`

- **Purpose**: Create a transaction manually.
- **Logic**: Automatically triggers wallet balance adjustment in `keiri_core`.

### `PATCH /api/transactions/:id`

- **Purpose**: Update transaction details.
- **Logic**: Calculates balance differences and updates `transaction_edits` audit log.

### `DELETE /api/transactions/:id`

- **Purpose**: Soft-delete a transaction and reverse its effect on wallets.

### `POST /api/transactions/split`

- **Purpose**: Distribute a transaction amount among multiple recipients via P2P requests.

---

## 2. Groups

Managed by **`keiri_core::services::groups`**.

### `GET /api/groups`

- **Purpose**: List groups the user belongs to.

### `POST /api/groups/create`

- **Purpose**: Create a new collaborative group (creator becomes ADMIN).

### `POST /api/groups/invite`

- **Purpose**: Create a P2P request of type `GROUP_INVITE`.

### `GET /api/groups/:id/transactions`

- **Purpose**: Fetch all transactions linked to a specific group.

### `DELETE /api/groups/:group_id/members/:user_id`

- **Purpose**: Remove a member from a group (ADMIN only).

---

## 3. P2P & Settling

Managed by **`keiri_core::services::p2p`**.

### `GET /api/p2p/pending`

- **Purpose**: Retrieve inbound debt requests and group invites.

### `POST /api/p2p/accept`

- **Purpose**: Approve a request. If it's a debt, it creates a mirrored transaction for the receiver.

### `POST /api/p2p/ledger-tabs`

- **Purpose**: Create a "running tab" between two users.

### `POST /api/p2p/ledger-tabs/:id/repayment`

- **Purpose**: Register a payment against an open tab, updating the tab status (PARTIALLY_PAID/SETTLED).

---

## 4. OCR & File Processing

Managed by **`keiri_core::services::ocr`**.

### `POST /api/ocr/process`

- **Purpose**: Start an asynchronous OCR background job.
- **Security**: Validates that the file key belongs to the authenticated user.

### `GET /api/ocr/status/:job_id`

- **Purpose**: Poll the status of an OCR job (`PENDING`, `COMPLETED`, `FAILED`).

---

## 5. Wallets

Managed by **`keiri_core::services::wallets`**.

### `GET /api/wallets`

- **Purpose**: List all wallets and their current balances.

### `POST /api/wallets`

- **Purpose**: Create a new wallet (Cash, Bank, etc.).

---

## 6. Subscriptions

Managed by **`keiri_core::services::subscriptions`**.

### `GET /api/subscriptions/detect`

- **Purpose**: Algorithmically identify recurring payment patterns in history.

---

## 7. Budgets

Managed by **`keiri_core::services::budgets`**.

### `GET /api/budgets`

- **Purpose**: List all active spending limits.

### `POST /api/budgets`

- **Purpose**: Create a new budget limit for a category or overall.
- **Payload**: `{ category_id: string | null, amount: Decimal, period: BudgetPeriod }`.

### `PATCH /api/budgets/:id`

- **Purpose**: Update an existing budget's limit or cycle.

### `DELETE /api/budgets/:id`

- **Purpose**: Stop tracking a budget.

### `GET /api/budgets/health`

- **Purpose**: Retrieve calculated spending progress (consumption percentage) for all budgets.

---

## 8. Authentication

Powered by `better-auth` re-exports.

- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-up/email`
- `GET /api/auth/get-session`
- `POST /api/auth/sign-out`

---

## 9. Demo Data

Managed by **`keiri_core::services::demo`**.

### `GET /api/demo/status`

- **Purpose**: Check if the user is currently exploring with demo data.
- **Response**: `{ "active": boolean }`.

### `POST /api/demo/seed`

- **Purpose**: Provisions realistic mock data (Wallets, Categories, Budgets, Contacts, and Transactions) for new users to explore the dashboard.
- **Logic**: Operates within a single database transaction. Sets the `demo_active: true` flag in the user's metadata.

### `POST /api/demo/clear`

- **Purpose**: Instantly wipes all user data (transactions, wallets, categories, etc.) to provide a clean slate. Unsets the `demo_active` flag.
