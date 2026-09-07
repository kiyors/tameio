# Smart Budgeting System

The Smart Budgeting System allows users to set spending limits per category (or overall) and track their financial health in real-time. It calculates spending velocity against defined limits for specific periods (Weekly, Monthly, Yearly).

## 1. Architectural Overview

Managed via the `budgets` crate, surfaced as `keiri_core::budgets` (target: `keiri_core::services::budgets`; see `docs/core.md`).

- **Logic Hub**: The `BudgetsManager` in `crates/budgets` calculates "Budget Health" by aggregating actual outbound transactions against user-defined limits. In the `get_all_budget_health` function, this relies on a precise SeaORM query that sums amounts: `transactions::Entity::find().filter(transactions::Column::Direction.eq("OUT"))`, specifically bounded by the calculated start and end dates.
- **Period Handling**: Supports dynamic date range calculation for Weekly (Monday-start), Monthly, and Yearly cycles.
- **Consumption Tracking**: Calculates `percentage_consumed` to drive visual indicators (Green/Amber/Red) in the UI.

---

## 2. Database Schema

### `budgets`

| Column        | Type             | Description                                                  |
| ------------- | ---------------- | ------------------------------------------------------------ |
| `id`          | `String`         | Unique identifier (UUID v7).                                 |
| `user_id`     | `String`         | Owner of the budget.                                         |
| `category_id` | `Option<String>` | Specific category limit, or `null` for total spending limit. |
| `amount`      | `Decimal`        | The defined spending limit.                                  |
| `period`      | `BudgetPeriod`   | Cycle type: `WEEKLY`, `MONTHLY`, `YEARLY`.                   |

### Enums Reference

| Enum Name      | Values                        | Used By          |
| -------------- | ----------------------------- | ---------------- |
| `BudgetPeriod` | `WEEKLY`, `MONTHLY`, `YEARLY` | `budgets.period` |

---

## 3. API Reference (`/api/budgets`)

### `GET /api/budgets`

- **Purpose**: List all active budgets for the authenticated user.

### `POST /api/budgets`

- **Purpose**: Create a new spending limit.
- **Payload**: `{ category_id?, amount, period }`.

### `PATCH /api/budgets/:id`

- **Purpose**: Update an existing budget's limit or period.

### `DELETE /api/budgets/:id`

- **Purpose**: Remove a budget tracking entry.

### `GET /api/budgets/health`

- **Purpose**: Fetch calculated spending progress for all budgets.
- **Response**: Array of `BudgetHealth` objects exported seamlessly to TypeScript via `ts-rs`:
  ```typescript
  {
    budget_id: string;
    category_name: string | null;
    limit_amount: string;
    spent_amount: string;
    remaining_amount: string;
    percentage_consumed: string;
    period: "WEEKLY" | "MONTHLY" | "YEARLY";
  }
  ```

---

## 4. Frontend Integration

### Dashboard Widgets

- **Budget Health Widget**: A specialized card on the main overview that displays progress bars for the top 4 budgets.
- **Visual Feedback**:
  - **Blue/Primary**: Safe (< 85% consumed).
  - **Amber**: Warning (> 85% consumed).
  - **Red**: Over-limit (> 100% consumed).

### Management UI

- Found in **Settings > Budgets**.
- Allows detailed management of limits and displays precise "Remaining" vs "Spent" breakdowns.

---

## 5. Maintenance Note

> [!WARNING]
> If database entities are regenerated using `sea-orm-cli`, the `TS` derive traits and `#[ts(export)]` attributes in `crates/db/src/entities/budgets.rs` must be manually restored to maintain TypeScript type safety, as the automated `process_entities.py` script has been deprecated to ensure clean formatting.
