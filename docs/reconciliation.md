# Bank Statement Reconciliation (`crates/reconciliation`)

The Reconciliation service allows users to upload raw bank statements and match them against recorded transactions, ensuring the digital ledger matches real-world bank records.

> **Naming note:** `keiri_core::services::reconciliation` describes the **target** layout. The working path today is `keiri_core::reconciliation` (facade over the `reconciliation` crate). See `docs/core.md`.

## 1. Logic Workflow

Reconciliation follows a three-step pipeline: **Ingestion**, **Fuzzy Matching**, and **Confirmation**.

### Step 1: Ingestion

Raw statement data is uploaded and parsed into `bank_statement_rows`. Each row represents a single line in a bank statement, containing a date, description, and debit/credit amount.

### Step 2: Fuzzy Matching

The `get_row_matches` engine attempts to find existing `transactions` that correspond to a statement row using a weighted scoring system. It initially filters transactions by `amount.abs()` matching exactly and date being within `+/- 3 days` using `Duration::days(3)`. Then it applies scoring:

| Factor                    | Weight/Logic                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| **Base Score**            | Starts at 70 for falling into the initial filter (`amount` + `date` range).                |
| **Exact Amount Match**    | `+10` points if `txn.amount == amount.abs()`.                                              |
| **Exact Date Match**      | `+10` points if `txn.date == row.date`.                                                    |
| **Description Tag Match** | `+10` points if `row.description.to_lowercase()` contains the transaction's `purpose_tag`. |

### Step 3: Confirmation

When a user confirms a match, the system:

1.  Creates a record in `statement_txn_matches`.
2.  Flags the `bank_statement_row` as `is_matched = true`.
3.  Calculates the "Confidence Level" for audit reporting.

---

## 2. Service Hub Orchestration

Managed by **`keiri_core::services::reconciliation`**.

- **Transaction Integrity**: Confirmation logic is wrapped in a database transaction. If the match fails to record, the row status remains unmatched.
- **Deduplication**: Unmatched rows are surfaced on the dashboard to prompt the user to either "Match" or "Create New Transaction" from the row data.

---

## 3. Database Schema

### `bank_statement_rows`

- Stores raw line items from CSV/PDF exports.
- `is_matched`: Boolean flag used to filter the dashboard "Inbox".

### `statement_txn_matches`

- The join table linking statement rows to finalized transactions.
- Includes `confidence` (Decimal) and `matched_at` (Timestamp) for audit trails.
