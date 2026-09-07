# Keiri (経理)

> **Keiri (経理)**: Derived from Japanese, literally meaning _accounting_, _bookkeeping_, or _financial administration_. It represents clarity, balance, and precision in managing accounts, expenses, and records.

Keiri is an intelligent bookkeeping and financial management platform built with Rust and TypeScript. It bridges the gap between raw financial documents (receipts, invoices, and bank statements) and structured accounting records through automated AI-powered OCR, intelligent transaction reconciliation, subscription tracking, and collaborative shared ledgers.

---

## Architecture

- **`apps/api` (Rust / Axum):** Thin HTTP entry point and routing gateway. Delegates all domain logic directly to `keiri_core`.
- **`crates/keiri_core` (Rust):** The centralized "Bank Brain" orchestrating the database connection pool, Better Auth, S3/R2 storage, OCR pipelines, and domain managers.
- **`apps/dashboard` (TanStack Start / React):** Modern, responsive web application utilizing TanStack Router, TanStack Query, Tailwind CSS v4, and Shadcn UI.
- **`crates/ocr` (Rust):** High-throughput background worker pipeline leveraging Google Gemini Flash for deterministic receipt parsing and field extraction.
- **`packages/ui` (`@keiri/ui`):** Reusable accessible UI design system components.
- **`packages/types` (`@keiri/types`):** Canonical TypeScript type declarations synchronized directly from Rust models via `ts-rs`.
- **`packages/wasm` (`@keiri/wasm`):** Client-side WebAssembly modules for instant fuzzy search and mathematical calculations.

---

## Key Features

- **Decoupled Core Architecture**: Business logic is strictly centralized in `crates/keiri_core`, keeping API routes clean and declarative.
- **Smart Reconciliation & Merging**: Automatically links scanned physical receipts with cryptic bank statement imports, merging OCR item details into banking records.
- **Itemized Splits**: Parses line items on receipts so expenses can be broken down and shared item-by-item across friends or team members.
- **Subscription Intelligence**: Heuristic detection of recurring cycles, renewal alerts, and price change notifications.
- **Shared Ledgers & P2P Tracking**: Real-time collaborative ledgers for roommates, trips, and shared expenses with simplified debt settlement calculations.
- **Local-First Speed**: Instant responsiveness powered by frontend caching (`wa-sqlite` / OPFS) alongside reactive TanStack Query caches.
- **One-Click Demo Environment**: Provision realistic sample wallets, budgets, categories, and transactions instantly for sandbox testing.

---

## Prerequisites

- **Node.js**: v24 or higher
- **pnpm**: v10 or higher
- **Rust**: Latest stable edition (2024 edition)
- **Database**: PostgreSQL (recommended for production) or SQLite (for local testing)
- **Storage**: S3-compatible storage (Cloudflare R2, MinIO, or AWS S3)

---

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone git@github.com:kiyors/keiri.git
   cd keiri
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env` in the root and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

4. **Initialize database and run migrations:**

   ```bash
   cargo run -p migration -- up
   ```

5. **Start development servers:**
   ```bash
   pnpm dev
   ```

---

## Testing

```bash
# Test the centralized core logic
cargo test -p keiri_core

# Test the OCR engine
cargo test -p ocr

# Run frontend tests
pnpm --filter @keiri/dashboard test

# Run all test suites
pnpm test:all
```

---

## Environment Variables

| Variable               | Description                                                                |
| :--------------------- | :------------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL or SQLite connection string (e.g. `sqlite://keiri.db?mode=rwc`) |
| `BETTER_AUTH_SECRET`   | 32+ character encryption secret for Better Auth                            |
| `BETTER_AUTH_BASE_URL` | Base URL for auth handlers (e.g. `http://localhost:7878`)                  |
| `S3_ENDPOINT`          | S3-compatible endpoint (Cloudflare R2, MinIO, or AWS S3)                   |
| `S3_ACCESS_KEY_ID`     | Storage access key ID                                                      |
| `S3_SECRET_ACCESS_KEY` | Storage secret access key                                                  |
| `S3_BUCKET_NAME`       | S3 bucket name for uploads                                                 |
| `GOOGLE_API_KEY`       | Google Gemini API key for OCR parsing                                      |
| `GEMINI_MODEL`         | Gemini model (e.g. `gemini-2.0-flash-exp`)                                 |
| `API_PORT`             | HTTP port for the Rust API server (default `7878`)                         |
