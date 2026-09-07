# Keiri Development Guide

This document provides technical instructions for setting up the Keiri monorepo, running services locally, and following project-wide engineering standards.

## 1. Prerequisites

Ensure you have the following installed:

- **Node.js**: v24+ ([pnpm](https://pnpm.io/) is required)
- **Rust**: Latest stable (via [rustup](https://rustup.rs/))
- **PostgreSQL**: Local or cloud instance.
- **S3 / Cloudflare R2**: Access keys and a bucket for file uploads.

---

## 2. Local Setup

### Step 1: Install Dependencies

```bash
# Node.js workspace
pnpm install

# Rust workspace
cargo build
```

### Step 2: Configuration (Secrets Management)

Keiri uses [`secretspec`](https://secretspec.dev/) with `sops` as the provider and `age` for environment variable encryption. Encrypted secrets are safely committed to the repository in `secrets.yml`.

1. **Prerequisites:** Ensure `sops`, `age`, and `secretspec` are installed (or simply run `nix develop` if you are using Nix, which provides them automatically).
2. **Setup your Age Key:** Obtain the project's `age` private key and configure it (e.g., place it in `~/Library/Application Support/sops/age/keys.txt` on macOS).
3. **Running the Application:**
   Instead of using a plaintext `.env` file, you can inject the decrypted variables dynamically at runtime and ensure all required secrets are present:
   ```bash
   secretspec run --provider sops://secrets.yml -- pnpm dev
   ```
   **Alternative (Local `.env`):** If you prefer using a traditional `.env` file (which is ignored by Git), you can decrypt `secrets.yml` into a local `.env` file:
   ```bash
   sops -d secrets.yml > .env
   ```
4. **Modifying Secrets:**
   To add or update variables, edit the encrypted file in place. It will be decrypted for your editor and re-encrypted upon saving:
   ```bash
   sops secrets.yml
   ```
   _Note: Ensure any new required secrets are also declared in `secretspec.toml`._

### Step 3: Database Migrations

Initialize the schema and seed system data:

```bash
cargo run -p migration -- up
```

---

## 3. Development Workflow

### Running Services

The project uses [Turborepo](https://turbo.build/) to manage parallel execution.

```bash
# Run all services (API, Dashboard)
pnpm dev

# Run a specific application
pnpm dev:dashboard
pnpm dev:app
```

### Formatting & Linting

Keiri enforces strict styling via Biome (JS/TS) and Cargo Fmt (Rust).

```bash
# Format everything
pnpm fmt-all

# Check for linting errors
pnpm check
```

---

## 4. Engineering Mandates

1.  **Architecture**: All business logic must reside in `crates/keiri_core`. The `apps/api` should remain a thin routing layer.
2.  **Type Safety**: Never use `any` in TypeScript. Use the models generated from Rust found in `packages/types/src/db`.
3.  **Database**: All schema changes must be performed via new files in `crates/migration`. Never modify existing migrations.
4.  **Security**: Always use the `AuthSession` extractor in Axum handlers to ensure endpoints are authenticated and scoped to the user.

---

## 5. Helpful Commands

| Command                           | Description                                         |
| --------------------------------- | --------------------------------------------------- |
| `pnpm clean`                      | Wipe all build artifacts, node_modules, and caches. |
| `cargo test -p db`                | Regenerate TypeScript types for the frontend.       |
| `cargo run -p migration -- fresh` | Reset the database to a clean state.                |
| `pnpm build`                      | Production release check for the entire stack.      |
