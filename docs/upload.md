# Keiri File Processor & Upload Architecture (`crates/upload`)

This document outlines the architecture, data-processing bounds, and storage integration implemented strictly within the backend's standalone `crates/upload` Rust library and its orchestration via the **`keiri_core`** hub.

The `crates/upload` module operates as a deeply decoupled engine bridging the **`keiri_core`** logic hub to S3-compatible remote blob storage (e.g., AWS S3, Cloudflare R2, MinIO).

## Architectural Overview

- **Logic Path**: **`apps/api`** -> **`crates/keiri_core`** -> `crates/upload` -> `S3 Bucket`.
- **Core SDK**: `aws_sdk_s3` + `aws-config`.
- **Centralized Hub Integration**: The **`keiri_core::Core`** struct initializes the `UploadClient` and provides it to all internal services (like OCR processing).
- **Media Processing**: Uses the `image` crate formats natively within the `UploadProcessor` to validate and re-compress bytes to standardize payloads via `compress_opts`.
- **Security Modules**: `infer` crate for deep byte-level MIME inspections.

---

## 1. Storage Integrations (`UploadClient`)

The core execution wrapper, managed by the **`keiri_core::Core`** instance.

### `upload_direct`

- Ingests raw memory bytes.
- Key structure: `{user_id}/{uuid}-{sanitized_filename}`.

### `get_presigned_url`

- Provides secure natively expiring URLs for client-side uploads.
- Mitigates path traversal securely.

### `get_file`

- Downloads raw bytes from S3 for internal processing (e.g., by the OCR service).

---

## 2. File Categorization Matrix

Before allowing _any_ bytes into storage, the `UploadProcessor` executes a strictly ordered tiered inspection.

### Available Mappings (`FileCategory`)

| Enum State | Handled Types                     | Post-Processing                                  |
| ---------- | --------------------------------- | ------------------------------------------------ |
| `Image`    | `.png`, `.jpeg`, `.webp`, `.heic` | Can convert all formats to standardized bytes.   |
| `Pdf`      | `application/pdf`                 | Ingested for PDF scraping flows.                 |
| `Csv`      | `application/csv`                 | Validates UTF-8 boundaries.                      |
| `Unknown`  | Other structures                  | Flagged as `Unknown` to mitigate security risks. |

---

## 3. Image Compression & Normalization

Integrated into the **`keiri_core`** upload workflow:

- **Avatars**: Standardized to WebP (512x512).
- **Receipts**: Normalized to ensure compatibility with the downstream native OCR worker.
- This prevents the background Rust processor from encountering unsupported byte formats.

---

## 4. Security & Validation

- **IDOR Protection**: The **`apps/api`** routing layer validates that every file `key` requested for processing or download starts with the authenticated user's ID.
- **Path Traversal Mitigation**: Filenames are strictly sanitized within `crates/upload` using `Path::new(name).file_name()` before being incorporated into S3 paths. This strips any malicious segments like `../` to prevent bucket-level traversal.
