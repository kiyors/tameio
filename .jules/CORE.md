This document serves as the canonical source of truth for the Keiri project's standards, architecture, and development workflows. Adhere to these guidelines strictly when contributing to the codebase.

## 🚀 Project Overview

Keiri is an intelligent expense management platform. It leverages OCR for receipt ingestion, automated subscription detection, and shared ledgers for group tracking.

### Tech Stack

- **Backend (Rust):** Axum for the API layer (`apps/api`), with all business logic centralized in the "Bank Brain" hub (`crates/keiri_core`).
- **Frontend (Web):** TanStack Start / React Router (`apps/dashboard`) using TanStack Query, Vite, and Zustand.

- **OCR Engine (Rust):** Native background worker (`crates/ocr`) using Gemini 2.5 Flash for deterministic JSON extraction.
- **Database:** PostgreSQL managed via `sea-orm`.
- **Infrastructure:** Monorepo managed with `pnpm` (JS/TS) and `cargo` (Rust).

---

## 🏛️ Architectural Principles

### The "Central Hub" Pattern

All business logic MUST reside in `crates/keiri_core`.

- `apps/api` should be a "thin" layer that only handles HTTP routing and calls services in `keiri_core`.
- Database entities live in `crates/db`. Pure entities should not contain business logic.
- Shared types are generated from Rust to TypeScript via `ts-rs` in `packages/types`.

### Surgical Changes

- **Touch only what you must.** Avoid refactoring adjacent code unless it is directly required for your task.
- **No speculative features.** Do not add abstractions for single-use code or "just-in-case" configurations.
- **Match existing style.** Even if you disagree with a pattern, maintain consistency with the surrounding code.

---

## 📝 Commit Standards

We follow the **Conventional Commits** specification. Commit messages must be high-signal and professional.

### Format

`<type>(<scope>): <description>`

`[Optional Body]`

`[Optional Footer]`

### Types

- `feat`: A new feature (e.g., `feat(core): implement smart-merge for bank statements`)
- `fix`: A bug fix (e.g., `fix(ocr): handle malformed date strings in receipts`)
- `ui`: UI/UX improvements or layout changes
- `security`: Security patches or enhancements
- `docs`: Documentation changes only
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools/libraries

### Rules for Titles

- **Imperative Mood:** Use "Add", "Fix", "Update", not "Added", "Fixed", "Updates".
- **No Period:** Do not end the title with a period.
- **Capitalization:** Capitalize the first letter of the description.
- **Concise:** Keep the title under 50 characters if possible.

### Rules for Body

- Explain **WHY** the change was made, especially for non-obvious logic.
- Mention any breaking changes or migration requirements.

---

## 🛠️ Development Workflow

### Verification Commands

Before submitting any code, run the relevant verification commands:

| Scope           | Command                                            |
| :-------------- | :------------------------------------------------- |
| **All (JS/TS)** | `pnpm fmt-all`                                     |
| **Dashboard**   | `cd apps/dashboard && pnpm tsc && pnpm vitest run` |
| **Rust Core**   | `cargo test -p keiri_core`                         |
| **Rust API**    | `cargo check -p api`                               |

### TDD (Test Driven Development)

For the Rust backend, TDD is **mandatory**.

1. Write a failing test in `keiri_core` or the relevant crate.
2. Implement the minimum code to make it pass.
3. Refactor while keeping the tests green.

---

## 📦 Pull Request (PR) Requirements

Every PR must provide enough context for a reviewer to understand the impact of the changes.

### PR Title

Match the commit standard: `type(scope): Description`

### PR Description Template

1. **Summary:** 1-2 sentences on what this PR does.
2. **Problem/Context:** Why is this change necessary?
3. **Solution:** How did you solve it? (Technical highlights).
4. **Verification:** List the commands run and provide evidence (test logs, screenshots).
5. **Linked Issues:** e.g., `Closes #123`.

---

## 💡 Pro-Tips for Jules

- **Dependency Audit:** Check `package.json` or `Cargo.toml` before adding new libraries. Use existing ones if possible.
- **Atomic Operations:** When modifying financial data, always use database transactions (`db.transaction`).
- **Simplicity:** If you can solve a problem in 50 lines instead of 200, do it. Senior engineers value clarity over cleverness.
