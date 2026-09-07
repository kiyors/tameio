# Shared Workspace Packages (`packages/`)

To maintain consistency and reduce duplication across the Dashboard and Mobile apps, Keiri utilizes shared workspace packages for UI components and TypeScript types.

## 1. UI Component Library (`packages/ui`)

A design-system-first library built with **Tailwind CSS v4** and headless component libraries.

- **Structure**:
  - **`src/components/`**: Atomic UI components (Buttons, Inputs, Dialogs, etc.) styled with a consistent design language. For instance, `button.tsx` utilizes `@base-ui/react/button` as an accessible primitive and applies robust variant styling using `cva` from `class-variance-authority`.
  - **`src/styles/globals.css`**: The central Tailwind configuration and CSS variables for the entire ecosystem.
  - **`src/lib/utils.ts`**: Common styling utilities like `cn` (clsx + tailwind-merge).
- **Consumption**:
  - Components are exported via sub-paths: `import { Button } from "@keiri/ui/components/button"`.
  - Used by both `apps/dashboard` (Next.js) and `apps/app` (via NativeWind bridging).

---

## 2. Shared Types (`packages/types`)

The single source of truth for data structures across the frontend applications.

- **Backend-Driven**: Most types in `src/db/` are automatically generated from Rust models using `ts-rs`.
- **Manual Extensions**: `src/index.ts` and `src/ocr.ts` contain manually defined union types and interface extensions for specialized frontend logic.
- **Workflow**:
  - When the database schema changes, run `cargo test -p db` to regenerate the TypeScript interfaces.
  - The `pnpm clean` command handles removing these generated artifacts when a full reset is needed.

---

## 3. Best Practices

1.  **Headless-First**: Use Base UI primitives to ensure accessibility, then apply custom Tailwind styles.
2.  **No Logic**: Shared packages should contain minimal business logic. They are for presentation (UI) and structural definitions (Types).
3.  **Strict Casing**: Always use Singular PascalCase for types (e.g., `P2pRequest`, not `p2p_requests`).
