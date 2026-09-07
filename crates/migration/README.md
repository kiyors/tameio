# SeaORM Migration CLI

This crate handles database schema migrations using [SeaORM](https://www.sea-ql.org/SeaORM/).

## Setup

Ensure your `DATABASE_URL` is set in the environment or `.env` file.

### Local SQLite Setup

For a local SQLite database, use:

```sh
DATABASE_URL="sqlite://keiri.db?mode=rwc"
```

The `?mode=rwc` flag tells SQLite to create the file if it doesn't exist.

## Running Migrations

Run these commands from the root directory using the `--package migration` flag, or from within this directory.

- **Apply all pending migrations (Initialize DB)**
  ```sh
  cargo run --package migration -- up
  ```
- **Generate a new migration file**
  ```sh
  cargo run --package migration -- generate MIGRATION_NAME
  ```
- **Rollback last applied migration**
  ```sh
  cargo run --package migration -- down
  ```
- **Check migration status**
  ```sh
  cargo run --package migration -- status
  ```
- **Reset database (Drop all tables and re-run migrations)**
  > ⚠️ **DANGER:** This will wipe all data in your database. Never use this in production.
  ```sh
  cargo run --package migration -- fresh
  ```

## Data Preservation and Row Updates

When adding new columns, you must ensure that existing data is not lost and that new columns are populated correctly for all users.

### ⚠️ Production Safety Rules

1. **NEVER** use `cargo run --package migration -- fresh` in production. This drops all tables and wipes all data.
2. **Always** use `cargo run --package migration -- up` to apply pending migrations.
3. When adding a `NOT NULL` column, you must provide a default value or populate it in the migration to avoid errors with existing rows.
4. **DO NOT** remove or rename columns that contain critical data without a clear data migration plan.

### Updating Existing Rows

If you add a new column and need to update all existing rows for every user (e.g., setting a default or calculating a value), create a new migration and use the `UPDATE` statement.

- **Example Migration to Update All Rows:**

  ```rust
  // Inside your migration's `up` method
  manager
      .execute(
          Statement::from_string(
              manager.get_database_backend(),
              "UPDATE table_name SET new_column = 'default_value' WHERE new_column IS NULL".to_owned(),
          )
      )
      .await?;
  ```

- **Run migrations to update all users:**
  ```sh
  cargo run --package migration -- up
  ```

## Advanced Commands
