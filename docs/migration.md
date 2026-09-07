# Keiri Database Migrations Architecture (`crates/migration`)

This document strictly defines the operational procedures and history mapping handled intrinsically by the `crates/migration` package.

Unlike standard ORM implementations, Keiri explicitly abstracts execution of database versioning cleanly into its own unified crate (`crates/migration`) driven directly by SeaORM internals and managed within the workspace dependency graph.

## Architectural Overview

- **Logic Engine**: `sea_orm_migration`.
- **Database Standard**: Structured for PostgreSQL compatibility (previously SQLite).
- **Execution Runtime**: Can be run entirely standalone `cargo run -p migration` or securely automated at Rust **`apps/api`** startup.
- **Workspace Integration**: Inherits version and edition from the root workspace `Cargo.toml`.

---

## 1. Migration Topology

Every migration represents a precise deterministic schema difference executed linearly. The internal `src/` directory defines them matching explicit timestamped bounds.

### Currently Implemented Migration Sets

_The following operations are already mapped to `db::entities::_`and`docs/database_schema.md`.\*

| ID / Timecode       | Migration Focus        | Operation Execution                                          |
| ------------------- | ---------------------- | ------------------------------------------------------------ |
| `m20220101_000001`  | **Base Architecture**  | Foundational entities: `users`, `sessions`, `accounts`, etc. |
| `m20260331_092335`  | **Groups Extrusion**   | Standalone `groups` and `user_groups` bridging tables.       |
| `m20260331_181001`  | **Better Auth Parity** | OAuth missing fields down to `users`.                        |
| `m20260331_185523`  | **Contacts Linkage**   | Transactions FK toward `contact_links`.                      |
| `m20260401_000001`  | **Indexing Boost**     | Performance indices for lookup columns.                      |
| `m20260403_000001`  | **Financial Refactor** | `amount` mapping to fixed decimal parsing.                   |
| `m20260404_000001+` | **Feature Extensions** | Categories, notes, reconciliation fixes, and OCR jobs.       |
| `m20260422_000001`  | **Smart Budgeting**    | Creation of the `budgets` table and related cycle enums.     |
| `m20260526_000001+` | **Background Workers** | Job notifications, performance indexes, and tracking fields. |

---

## 2. Bootstrapping Execution

Keiri executes standard upgrades inherently within the architecture bounds:

### The `Migrator` Struct (`src/lib.rs`)

The `lib.rs` file defines a `Migrator` struct implementing `sea_orm_migration::MigratorTrait`. It registers all migration files in explicit chronological order within the `migrations()` method.

### Production / Runtime Automation

1. The **`keiri_core`** hub handles the connection to the database.
2. The migrator is typically invoked during the initialization phase of the application stack.
3. Because changes are executed progressively in the same transaction loop, an application _never_ boots connected to a drifted database state.

### Manual Execution

For CI/CD sanity checks or sandbox wipes:

```bash
# Rollback the last migration
cargo run -p migration -- down -n 1

# Force flush the database entirely
cargo run -p migration -- fresh
```

---

## 3. Strict Rules for Future Migrations

1. **Never mutate old migrations**: Append a _new_ `.rs` migration file resolving the difference.
2. **Abstract Foreign Keys**: Define `ForeignKey` relationships explicitly utilizing `sea_query`.
3. **Rust Type Alignment**: After applying a migration, the `crates/db/src/entities/` block _MUST_ be re-synced using `sea-orm-cli` to maintain type safety.
