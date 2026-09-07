# Keiri Dashboard Architecture & UI Documentation

This document covers the architectural layout, frontend stack, routing structure, and component methodology established for the Keiri web dashboard.

## Architectural Overview

The dashboard is built within the `apps/dashboard` monorepo package. It leverages cutting-edge React ecosystem tools tailored for highly dynamic, visually heavy reporting and transaction management interfaces.

- **Framework**: TanStack Start / React Router.
- **Core Library**: React 19.
- **State & Data Management**:
  - Server Cache & Operations: `@tanstack/react-query`
  - Offline / Fast Persistence: `@journeyapps/wa-sqlite` mounted to OPFS inside TanStack Store.
  - Client Global App State: `zustand`
- **Styling**: Tailwind CSS v4 & `next-themes`.
- **Assets**: Static SVG references using `mask-image` for rich CSS-based theme coloring with minimal JS bundle footprint.
- **Dependencies**: Imports strongly from shared workspace packages (`@keiri/ui` for UI and `@keiri/types` for TypeScript bounds).
- **Authentication**: Directly wired into `better-auth` using native React bindings.

---

## Codebase Structure & Component Strategy

The codebase is logically split in the `src/` directory to handle complex React scaling cleanly by decoupling core page logic from deeply styled UI blocks.

### `src/components/`

- **`auth/`**: Authentication pages.
- **`layout/`**: Global UI wiring (Sidebar, NavMain, NavUser, GlobalModals, CommandCenter, DemoBanner).
- **`dashboard/`**: Visualization components (Analytics, CategoryChart, Overview, WelcomeDialog).
- **`transactions/`**: Heavily targeted business logic forms.
- **`data-table/` & `tool-ui/`**: Advanced headless table components driven by `@tanstack/react-table`.

### `src/hooks/` & `src/lib/`

- **Hooks**:
  - `UseEntityForm.ts`: A unified, generic hook powering all creation and edit modals safely without boilerplate `useState` replication.
  - `UseTransactions.ts`: Handles data fetching and interfaces with the OPFS WA-SQLite database for sub-millisecond local reads.
  - `UseDemoData.ts`: Manages seamless backend seeding and clearing for new user onboarding.
- **Libs Environment**:
  - `QueryKeys.ts`: Strictly typed React Query keys for predictable cache invalidation.
  - `ApiClient.ts`: Pre-configured Axios instance.

---

## Routing Structure (Implemented Scope)

Built atop TanStack Router's file-based system (`src/routes`).

### 1. The `_dashboard` Layout

The secure boundary wrapped in a global `route.tsx`, forcing authentication checks via loaders before rendering child pages.

- **`/` (Home / Dashboard Root)**
  - **WelcomeDialog & DemoBanner**: Automatically detects 0 transactions and offers to seed the DB with realistic data (`POST /api/demo/seed`), alongside a one-click cleanup function (`POST /api/demo/clear`).
  - **Analytics UI**: Top-line metrics, category charts, budget tracking.
  - **P2P Notification Engine**: Handling group joins and settlements.
  - **OCR Upload**: Drag and drop receipt scanning with progress tracking.

- **`/transactions`**
  - **Rich Data Grid**: Leveraging `@tanstack/react-table` with server-side integration and deferred lazy-loaded fetching.

- **`/settings`**
  - **Budgets**: User-defined spending limits per category, visualized via the `BudgetHealthWidget`.
  - **User Controls**: Profile management and theme preferences.

### 2. Public Routes

- **`/sign-in`** & **`/sign-up`**

---

## Data Fetching & Architecture Patterns

Keiri frontend strictly follows explicit standardization to bridge reliably to the Rust **`apps/api`**:

1. **Routing Middleware (`beforeLoad`)**: Intercepts requests to check for `better-auth` sessions and redirects to `/sign-in` if missing.
2. **API Routing**: Pages fetch from `VITE_API_URL` (defaults to `http://localhost:7878`) with `credentials: "include"`.
3. **Aggressive Optimistic Updating (React Query)**: Uses `useMutation` with cache invalidation for a hyper-responsive UI.
4. **Form Standardization**: Leveraging `useEntityForm` to build highly reliable, memory-safe dialog modals.
5. **Toast Notifications**: Consistent feedback via the `@keiri/ui` `goey-toaster` component.
6. **Type Safety**: The dashboard uses types generated from the Rust backend via `ts-rs`, ensuring that models re-exported by **`keiri_core`** are perfectly synced with the frontend.
