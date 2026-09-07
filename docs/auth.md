# Keiri Authentication & Authorization (`crates/auth`)

This document outlines the architecture, data-flow boundaries, and implementation patterns governing user authentication in the Keiri ecosystem.

The system natively wraps the [Better Auth](https://github.com/better-auth/better-auth) standard within a strict Rust integration (`crates/auth`), coupling it tightly to the `axum` routing framework via the **`keiri_core`** hub.

## Architectural Overview

- **Logic Path**: `crates/auth` -> **`crates/keiri_core`** -> **`apps/api`** -> `apps/dashboard`.
- **Core Library**: `better_auth` (Rust Crate).
- **Plugins Injected**: `EmailPasswordPlugin`, `SessionManagementPlugin`.
- **Database Adapter**: A purely custom `PostgresAdapter` mapping standard `better_auth` entity traits explicitly to the `sea_orm` models (found in `crates/auth/src/adapter/`).
- **Centralized Orchestration**: The authentication system is initialized and managed by the **`keiri_core::Core`** struct, which acts as the unified hub for all backend services.
- **Axum Guards**: Exposes the seamless `AuthSession` extractor trait (re-exported by `keiri_core`) globally for injecting securely logged-in `User` data into API handlers.

---

## 1. Native Database Adapter (`src/adapter/`)

To achieve complete control over DB execution while staying compliant with `better_auth` specs, `crates/auth` avoids generic SQL adapters and instead implements the DB traits directly using `sea_orm`.

The `adapter/` directory enforces strict CRUD operations passing seamlessly from the BetterAuth core out to `sea_orm` entities defined in `crates/db`:

- **`user.rs`**: Inserts and fetches against the Base `db::entities::users` table.
- **`session.rs`**: Issues timed, IP-bound active session tokens into `db::entities::sessions`.
- **`account.rs`**: Manages OAuth bindings natively into `db::entities::accounts`.
- **`verification.rs`**: Stores short-lived OTP/verification links tightly against `db::entities::verifications`.
- **`others.rs`**: Implements required `better_auth` trait stubs for features with partial or future activation. Features not yet fully implemented return `AuthError::NotImplemented` or empty results:
  - `OrganizationOps` / `MemberOps` / `InvitationOps` — Placeholders for multi-tenant organization management.
  - `TwoFactorOps` — Placeholders for full TOTP/Backup code management. The `users.two_factor_enabled` field exists in the `users` table to track 2FA status.
  - `ApiKeyOps` — Programmatic API key management stubs.
  - `PasskeyOps` — WebAuthn passkey server-side persistence stubs.

---

## 2. Axum Session Extraction (`AuthSession`)

All guarded routes in **`apps/api`** (e.g., fetching transactions, uploading receipts) derive user context transparently by requesting `AuthSession` as an `axum` handler parameter.

### How `AuthSession` Works Internally (`src/lib.rs`)

1. **Header Interception**: Given an incoming request, `AuthSession::from_request_parts` extracts the raw HTTP headers natively.
2. **Mock Internal Request**: It compiles a pseudo HTTP `GET /get-session` request containing explicitly the user's origin headers and injects it internally into the `better_auth` state engine in-memory.
3. **Session Decoding**: The `better_auth` engine validates the JWT, checks database expiry tables, and returns a verified JSON packet resolving to the `User` struct natively.
4. **Failure Case**: Emits a `401 Unauthorized` block immediately intercepting execution before hitting the actual endpoint.

---

## 3. Configuration & Initialization

Bootstrapped within `init_auth()` and integrated into the **`keiri_core::Core::init()`** flow called by **`apps/api/src/main.rs`**.

### Environment Controls

The initialization reads strict environment variables to shape security behaviors tightly without demanding re-compilation.

| Environment Variable         | Impact / Default                 | Purpose                                                               |
| ---------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`         | Required                         | Cryptographic secret for signing/hashing JWTs.                        |
| `BETTER_AUTH_BASE_URL`       | Defaults `http://localhost:7878` | Essential binding URL aligning the plugin's cookie scoping logic.     |
| `CORS_ORIGIN`                | Appended to Trust list           | Comma-separated external UI domains added to the trusted origin pool. |
| `ENABLE_SIGNUP`              | Boolean (Default: `true`)        | Toggles new registration logic on/off.                                |
| `REQUIRE_EMAIL_VERIFICATION` | Boolean (Default: `false`)       | Toggles firm email verification handshakes.                           |

---

## 4. Frontend Bridging (`apps/dashboard`)

While `crates/auth` handles execution, `apps/dashboard` accesses this ecosystem using the unified TypeScript client exposed gracefully at `/api/auth`.

**Frontend Auth Client** (`src/lib/auth-client.ts`):
The dashboard creates a unified `better-auth/react` client with the following plugins:

- `passkeyClient()` — Enables WebAuthn passkey challenge flows.
- `usernameClient()` — Enables username-based lookups alongside email.

**Frontend API Endpoints Mapped Automatically**:

- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-up/email`
- `GET /api/auth/get-session`
- `POST /api/auth/sign-out`

Since both ecosystems share the strict protocol dictated by the `better_auth` specification, session headers (cookies named `better-auth.session_token` or `__Secure-better-auth.session_token`) bridge cross-origin seamlessly across environments.
