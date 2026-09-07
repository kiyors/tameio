# Keiri OCR & Extraction Worker (`crates/ocr`)

This document covers the structure and logic of the internal OCR background worker. It operates strictly as an asynchronous data-processing pipeline consumed by the **`keiri_core`** hub.

> **Naming note:** `keiri_core::services::*` paths below describe the **target** layout. The working path today is `keiri_core::ocr` (the facade re-exporting the `ocr` crate's `ops`/`worker`). See `docs/core.md` for the convention.

## Architectural Overview

- **Framework**: Native Rust (`crates/ocr`).
- **Worker Engine**: Background workers powered by `tokio::spawn` and `tokio_util::task::TaskTracker`.
- **Communication**: Uses PostgreSQL `LISTEN/NOTIFY` channels (`ocr_jobs_channel`) for near real-time job execution.
- **Resilience**: Features graceful shutdowns via `CancellationToken` and stale job recovery for tasks interrupted by restarts.
- **Orchestration**: Managed by **`keiri_core::services::ocr`**, which handles background job status, data mapping, and database persistence.

---

## 1. Extraction Pipeline

The primary worker orchestrates document classification and structured JSON transformation.

### Processing Pipeline Architecture:

1. **Validation**: Size checks and validation before scheduling the background job.
2. **Retrieval**: The worker securely downloads the document bytes from S3/R2 using `crates/upload`.
3. **Classification**: Document identified as `GPAY` or `GENERIC` via the native Rust GenAI client.
4. **Structured Extraction**: Gemini Schema conforming ensures deterministic JSON output.

---

## 2. Worker Diagnostics & Health

The OCR worker runs seamlessly within the `apps/api` Axum server process. It listens for shutdown signals (e.g., `SIGTERM`, `Ctrl+C`) and allows active jobs to finish securely before the server exits.
