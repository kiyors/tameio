use crate::OcrService;
use crate::OcrUpdate;
use crate::ops::lifecycle::{MAX_OCR_RETRIES, OcrJobUpdateParams, update_ocr_job};
use db::AppError;
use db::entities;
use rand::Rng;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use std::sync::Arc;
use upload::UploadClient;

/// Helper function to bridge with keiri_core for processing transactions.
pub trait OcrProcessor: Send + Sync {
    /// Full processing (includes DB insertion)
    fn process_ocr<'a>(
        &'a self,
        db: &'a DatabaseConnection,
        user_id: &str,
        processed: db::ProcessedOcr,
    ) -> std::pin::Pin<
        Box<
            dyn std::future::Future<Output = Result<db::OcrTransactionResponse, AppError>>
                + Send
                + 'a,
        >,
    >;

    /// Enrichment only (resolves suggestions without DB insertion)
    fn enrich_ocr<'a>(
        &'a self,
        db: &'a DatabaseConnection,
        user_id: &str,
        processed: db::ProcessedOcr,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<db::ProcessedOcr, AppError>> + Send + 'a>,
    >;
}

pub async fn process_job(
    db: &DatabaseConnection,
    ocr_service: Arc<OcrService>,
    upload_client: &UploadClient,
    ocr_tx: tokio::sync::broadcast::Sender<OcrUpdate>,
    processor: Arc<dyn OcrProcessor>,
    job_id: String,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let job = entities::ocr_jobs::Entity::find_by_id(job_id.clone())
        .one(db)
        .await?
        .ok_or_else(|| AppError::not_found("OCR Job not found"))?;

    if job.status != "QUEUED" && job.status != "PENDING" {
        return Ok(());
    }

    let user_id = job.user_id.clone();
    let trace_id = job.trace_id.clone();

    // Use raw_key if it's already a high-res attempt or if we want to try high-res
    let key = if job.is_high_res {
        job.raw_key.as_ref().unwrap_or(&job.r2_key).clone()
    } else {
        job.r2_key.clone()
    };

    // 1. Atomically claim the job (observed status -> PROCESSING). This guards
    //    against the poll tick, a LISTEN/NOTIFY wake-up, process_immediately, and
    //    other instances all racing on the same job: only the caller whose UPDATE
    //    actually affects a row proceeds; the rest return early.
    let claim = entities::ocr_jobs::Entity::update_many()
        .col_expr(
            entities::ocr_jobs::Column::Status,
            sea_orm::sea_query::Expr::value("PROCESSING".to_string()),
        )
        .col_expr(
            entities::ocr_jobs::Column::StartedAt,
            sea_orm::sea_query::Expr::value(chrono::Utc::now().naive_utc()),
        )
        .filter(entities::ocr_jobs::Column::Id.eq(job_id.clone()))
        .filter(entities::ocr_jobs::Column::Status.eq(job.status.clone()))
        .exec(db)
        .await?;

    if claim.rows_affected != 1 {
        // Lost the race; another worker already claimed this job.
        return Ok(());
    }

    let _ = ocr_tx.send(OcrUpdate {
        user_id: user_id.clone(),
        job_id: job_id.clone(),
        status: "PROCESSING".to_string(),
        trace_id: trace_id.clone(),
    });

    let process_res = async {
        let bytes = upload_client.get_file(&key).await?;

        // Determine filename and mime type from magic bytes or key extension
        let mut filename = key.split("/").last().unwrap_or("upload").to_string();

        let mime_type = if bytes.starts_with(b"%PDF-") {
            if !filename.to_lowercase().ends_with(".pdf") {
                filename.push_str(".pdf");
            }
            "application/pdf"
        } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
            if !filename.to_lowercase().ends_with(".png") {
                filename.push_str(".png");
            }
            "image/png"
        } else if bytes.starts_with(b"\xFF\xD8\xFF") {
            if !filename.to_lowercase().ends_with(".jpg") {
                filename.push_str(".jpg");
            }
            "image/jpeg"
        } else if bytes.starts_with(b"PK\x03\x04") {
            if !filename.to_lowercase().ends_with(".xlsx") {
                filename.push_str(".xlsx");
            }
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        } else {
            let ext = filename.split('.').next_back().unwrap_or("").to_lowercase();
            match ext.as_str() {
                "pdf" => "application/pdf",
                "csv" => "text/csv",
                "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "xls" => "application/vnd.ms-excel",
                "webp" => "image/webp",
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                _ => {
                    if bytes.len() > 10
                        && (bytes.contains(&b',') || bytes.contains(&b'\t'))
                        && bytes.iter().take(100).all(|&b| b.is_ascii() || b > 127)
                    {
                        if filename.len() < 4
                            || !filename[filename.len() - 4..].eq_ignore_ascii_case(".csv")
                        {
                            filename.push_str(".csv");
                        }
                        "text/csv"
                    } else {
                        "image/png"
                    }
                }
            }
        };

        let ocr_json = ocr_service
            .process_file(&bytes, &filename, mime_type)
            .await?;

        let mut processed_ocr: db::ProcessedOcr = serde_json::from_value(ocr_json.clone())?;
        processed_ocr.r2_key = Some(job.r2_key.clone());
        processed_ocr.is_high_res = job.is_high_res;

        // --- SMART ENRICHMENT ---
        // Pre-resolve wallet/contacts/categories
        processed_ocr = processor.enrich_ocr(db, &user_id, processed_ocr).await?;

        // Extract confidence from the inner data
        let confidence_score = match processed_ocr.doc_type.as_str() {
            "GPAY" => {
                let gpay: db::GPayExtraction =
                    serde_json::from_value(processed_ocr.data.0.clone())?;
                gpay.confidence_score
            }
            "GENERIC" => {
                let generic: db::OcrResult = serde_json::from_value(processed_ocr.data.0.clone())?;
                generic.confidence_score
            }
            "BANK_STATEMENT" => {
                let bank: db::BankExtractionResult =
                    serde_json::from_value(processed_ocr.data.0.clone())?;
                bank.confidence_score
            }
            _ => 1.0,
        };

        // 3. Progressive Quality Fallback
        if confidence_score < 0.8 && !job.is_high_res && job.raw_key.is_some() {
            tracing::info!(
                "⚠️ Low confidence ({}) for job {}, triggering high-res retry",
                confidence_score,
                job_id
            );
            return Ok::<
                (
                    db::ProcessedOcr,
                    String,
                    Option<String>,
                    Option<serde_json::Value>,
                ),
                Box<dyn std::error::Error + Send + Sync>,
            >((processed_ocr, "RETRY_HIGH_RES".to_string(), None, None));
        }

        let mut transaction_id = None;
        let mut final_status = "COMPLETED";
        let mut collision_data = None;

        if job.auto_confirm {
            match processor
                .process_ocr(db, &user_id, processed_ocr.clone())
                .await
            {
                Ok(res) => {
                    transaction_id = Some(res.transaction.id);
                }
                Err(e) => {
                    if let db::AppError::ContactCollision(candidates) = e {
                        tracing::warn!(
                            "⚠️ Contact collision for job {}, needs manual review",
                            job_id
                        );
                        final_status = "CONTACT_COLLISION";
                        collision_data = Some(candidates);
                    } else {
                        tracing::error!("❌ Auto-confirmation failed for job {}: {}", job_id, e);
                        final_status = "PENDING_REVIEW";
                    }
                }
            }
        } else {
            final_status = "PENDING_REVIEW";
        }

        Ok::<
            (
                db::ProcessedOcr,
                String,
                Option<String>,
                Option<serde_json::Value>,
            ),
            Box<dyn std::error::Error + Send + Sync>,
        >((
            processed_ocr,
            final_status.to_string(),
            transaction_id,
            collision_data,
        ))
    }
    .await;

    match process_res {
        Ok((processed, status, tx_id, candidates)) => {
            if status == "RETRY_HIGH_RES" {
                update_ocr_job(
                    db,
                    &job_id,
                    OcrJobUpdateParams {
                        status: "QUEUED".to_string(),
                        processed_data: None,
                        error_message: None,
                        transaction_id: None,
                        started_at: None,
                        retry_count: None,
                        last_error: None,
                        scheduled_at: Some(chrono::Utc::now()),
                        resolution_candidates: None,
                        // Escalate to high-res so the retry uses raw_key and the
                        // low-confidence guard cannot re-queue this job again.
                        is_high_res: Some(true),
                    },
                )
                .await?;

                let _ = ocr_tx.send(OcrUpdate {
                    user_id: user_id.clone(),
                    job_id: job_id.clone(),
                    status: "QUEUED".to_string(),
                    trace_id: trace_id.clone(),
                });
            } else {
                update_ocr_job(
                    db,
                    &job_id,
                    OcrJobUpdateParams {
                        status: status.to_string(),
                        processed_data: Some(serde_json::to_value(processed).map_err(|e| {
                            AppError::Ocr(format!("Failed to serialize processed OCR data: {}", e))
                        })?),
                        error_message: None,
                        transaction_id: tx_id,
                        started_at: None,
                        retry_count: None,
                        last_error: None,
                        scheduled_at: None,
                        resolution_candidates: candidates,
                        is_high_res: None,
                    },
                )
                .await?;

                let _ = ocr_tx.send(OcrUpdate {
                    user_id,
                    job_id: job_id.clone(),
                    status: status.to_string(),
                    trace_id,
                });
            }
        }
        Err(e) => {
            tracing::error!("❌ OCR Background Job {} failed: {}", job_id, e);

            let new_retry_count = job.retry_count + 1;

            if new_retry_count < MAX_OCR_RETRIES {
                let base_delay = 10;
                let backoff_secs = base_delay * (2_i64.pow(new_retry_count as u32));
                let jitter = rand::rng().random_range(0..5);
                let next_run =
                    chrono::Utc::now() + chrono::Duration::seconds(backoff_secs + jitter);

                update_ocr_job(
                    db,
                    &job_id,
                    OcrJobUpdateParams {
                        status: "QUEUED".to_string(),
                        processed_data: None,
                        error_message: None,
                        transaction_id: None,
                        started_at: None,
                        retry_count: Some(new_retry_count),
                        last_error: Some(e.to_string()),
                        scheduled_at: Some(next_run),
                        resolution_candidates: None,
                        is_high_res: None,
                    },
                )
                .await?;

                let _ = ocr_tx.send(OcrUpdate {
                    user_id: user_id.clone(),
                    job_id: job_id.clone(),
                    status: "QUEUED".to_string(),
                    trace_id,
                });
            } else {
                update_ocr_job(
                    db,
                    &job_id,
                    OcrJobUpdateParams {
                        status: "DEAD_LETTER".to_string(),
                        processed_data: None,
                        error_message: Some(e.to_string()),
                        transaction_id: None,
                        started_at: None,
                        retry_count: Some(new_retry_count),
                        last_error: Some(e.to_string()),
                        scheduled_at: None,
                        resolution_candidates: None,
                        is_high_res: None,
                    },
                )
                .await?;

                let _ = ocr_tx.send(OcrUpdate {
                    user_id,
                    job_id: job_id.clone(),
                    status: "DEAD_LETTER".to_string(),
                    trace_id,
                });
            }
        }
    }

    Ok(())
}
