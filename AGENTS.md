# Agent Instructions

## Tech Stack & Structure

- **Frontend**: `apps/dashboard` (TanStack Start / React Router)
- **Backend**: `apps/api` (Rust Axum)
- **Central Hub**: `crates/keiri_core` (Orchestrates DB, Auth, Upload, OCR)
- **Shared**: `packages/types` (Shared TS/Rust types), `packages/ui` (Shared UI)
- **Testing**: `rstest` (Rust Backend & API), `vitest` (Frontend Headless Logic). No UI E2E.

## Package Managers

- **JS/TS**: **pnpm**: `pnpm install`, `pnpm dev`, `pnpm add <package name> --filter`, `pnpm dlx shadcn@latest add button -c apps/dashboard`, `pnpm fmt`
- **Rust**: **cargo**: `cargo check`, `cargo run -p api`

## File-Scoped Commands

| Task          | Command                                   |
| ------------- | ----------------------------------------- |
| Typecheck     | `pnpm tsc --noEmit path/to/file.ts`       |
| Lint (JS)     | `pnpm lint`                               |
| Format (JS)   | `pnpm fmt`                                |
| Lint (Rust)   | `cargo clippy --fix -p <crate> -- <file>` |
| Format (Rust) | `cargo fmt`                               |
| Test (Rust)   | `cargo test -p keiri_core --lib`          |
| Test (JS/TS)  | `pnpm vitest run path/to/file.test.ts`    |
| Format (All)  | `pnpm fmt-all`                            |

## Documentation

- `AGENTS.md`: Canonical agent-facing documentation. Keep under 80 lines.
- `GEMINI.md`: Foundational mandates for Gemini CLI specifically.
- `docs/core.md`: Deep dive into the Centralized Hub Architecture.
- `ARCHITECTURE-MAP.md`: Skill file for generating `architecture-map.html` — an interactive visual map of the full codebase. Located at `.agents/skills/architecture-map/SKILL.md`.

<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

# Skill mappings - when working in these areas, load the linked skill file into context.

skills:

- task: "Managing local database collections and live queries"
  load: "node_modules/@tanstack/react-db/skills/react-db/SKILL.md"
- task: "Setting up typed collections and selecting sync adapters"
  load: "node_modules/@tanstack/db/skills/db-core/collection-setup/SKILL.md"
- task: "Implementing optimistic mutations and transactions"
  load: "node_modules/@tanstack/db/skills/db-core/mutations-optimistic/SKILL.md"
- task: "Working with persistent local storage (WA-SQLite, expo-sqlite)"
  load: "node_modules/@tanstack/db/skills/db-core/persistence/SKILL.md"
- task: "Configuring environment variables and secrets"
  load: "node_modules/dotenv/skills/dotenvx/SKILL.md"
- task: "Implementing authentication, two-factor, or organization best practices"
  load: "better-auth/skills"

- task: "Managing TanStack Start frontend, deployments, and React best practices"
  load: "vercel-labs/agent-skills"
- task: "Frontend UI, UX polish, and building web components"
  load: "anthropics/skills"
- task: "Rust API best practices and architecture"
  load: "apollographql/skills"

## 🛠️ Active Skill Constraints

When generating code or reviewing PRs, you must actively apply the loaded skills:

### 1. Authentication & Security (`better-auth`)

- **Core:** Follow `better-auth-best-practices` and `create-auth-skill`.
- **Security:** Adhere to `better-auth-security-best-practices`.
- **Flows:** Use `email-and-password-best-practices` and `two-factor-authentication-best-practices`.
- **Multi-tenant:** Structure orgs according to `organization-best-practices`.

### 2. Frontend Ecosystem (`tanstack`)

- **Architecture:** Use TanStack Router and TanStack Start file-based routing conventions.
- **Data Fetching:** Use TanStack Query (via loaders and hooks).
- **Styling:** Tailwind CSS v4 in Vite setup.

### 4. Frontend UI/UX Design

- **Components:** Build accessible interfaces using `shadcn` patterns.
- **Design:** Apply `frontend-design` and `web-design-guidelines`.
- **UX:** Polish using `ui-ux-pro-max` (micro-interactions, loading states).

### 5. Backend, Database & OCR

- **Rust Core:** TDD Red-Green-Refactor is mandatory. Use `#[rstest]` fixtures (`rust-best-practices`).
- **Rust Performance:** Avoid heap allocations in hot loops (use `&str` over `String`), use `HashMap::entry` API to avoid double lookups, use `rayon` for parallelizing iterators (`par_lines`/`par_iter`), and prefer `Vec::swap_remove` over `remove` when order doesn't matter.
- **Transactions:** Atomic operations MUST use `db.transaction`. Always adjust wallet balances.
- **Rust OCR:** Background job processing natively integrated in `crates/ocr` using Postgres LISTEN/NOTIFY and graceful shutdown tokens.
- **Database:** Pure entities go in `crates/db/src/entities/`. No business logic here. Design via `database-schema-designer`.

### 6. Repository Architecture (Monorepo Boundaries)

- **Central Hub (`crates/keiri_core`):** Orchestrates business rules, auth, and OCR delegation.
  - _Current:_ logic lives in the domain crates (`crates/wallets`, `crates/transactions`, `crates/ocr`, …) and is surfaced through the `keiri_core` facade as `keiri_core::<domain>` (e.g. `keiri_core::ocr`, `keiri_core::wallets`).
  - _Target:_ consolidate this logic under `keiri_core/src/services/`, split into granular files. New cross-crate orchestration should move toward this layout.
- **API Entry (`apps/api`):** API routes strictly delegate to the `keiri_core` facade (`keiri_core::<domain>`; target: `keiri_core::services`). No business logic in routes.
- **Shared Packages:** Do not define types or UI locally within apps. Use `packages/types` (generated via `ts-rs`) and `packages/ui`.
- **Dependency Management:** Common Rust dependencies belong in root `Cargo.toml` using `workspace = true`.

## 📝 General Directives

1. **Refactoring:** Consider UI/UX, database transaction safety, and Rust compiler guarantees first.
2. **Code Style:** Keep functions pure, use declarative patterns, prioritize readability.
3. **Documentation:** Comment on complex server-side logic, OCR processing steps, and Rust trait implementations.

## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five canonical triage roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout (a root `CONTEXT-MAP.md` pointing to per-context `CONTEXT.md` files). See `docs/agents/domain.md`.
