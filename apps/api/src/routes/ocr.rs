use axum::Router;
use axum::extract::{Json, Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::sse::{Event, Sse};
use axum::routing::{get, post};
use db::dto::{
    BulkConfirmOcrRequest, ConfirmOcrRequest, OcrJobResponse, ProcessImageOcrRequest,
    ResolveContactRequest,
};
use futures::stream::Stream;
use keiri_core::ocr;
use std::convert::Infallible;
use std::sync::Arc;

use crate::middleware::error::ApiError;
use crate::{AppState, AuthSession};
use ::jobs::JobQueueExt;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/process", post(process_image_ocr_handler))
        .route("/status/{job_id}", get(get_ocr_job_status_handler))
        .route("/stream", get(ocr_stream_handler))
        .route("/pending", get(list_pending_ocr_jobs_handler))
        .route("/confirm/{job_id}", post(confirm_ocr_job_handler))
        .route("/bulk-confirm", post(bulk_confirm_ocr_jobs_handler))
        .route("/resolve/{job_id}", post(resolve_ocr_job_handler))
}

pub async fn ocr_stream_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut rx = state.core.ocr_manager.ocr_tx.subscribe();
    let user_id = session.user.id.clone();

    let stream = async_stream::stream! {
        loop {
            match rx.recv().await {
                Ok(update) => {
                    // Only send updates for the current user
                    if update.user_id == user_id
                        && let Ok(event) = Event::default().json_data(update) {
                            yield Ok(event);
                        }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                    continue;
                }
                Err(_) => break,
            }
        }
    };

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}

pub async fn process_image_ocr_handler(
    State(state): State<AppState>,
    session: AuthSession,
    headers: HeaderMap,
    Json(payload): Json<ProcessImageOcrRequest>,
) -> Result<(StatusCode, Json<OcrJobResponse>), ApiError> {
    // 0. Check for idempotency key
    let idempotency_key = headers
        .get("x-idempotency-key")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    if let Some(ref key) = idempotency_key
        && let Some(existing_job) =
            ocr::get_ocr_job_by_idempotency_key(&state.core.db, &session.user.id, key).await?
    {
        return Ok((
            StatusCode::OK,
            Json(OcrJobResponse {
                job_id: existing_job.id,
                status: existing_job.status,
            }),
        ));
    }

    // Per-user rate limiting — proper 429 with Retry-After (not a 400) so
    // clients can back off intelligently and distinguish quota from input errors.
    if !state.ocr_limiter.check(&session.user.id) {
        return Err(ApiError::RateLimited(
            "Rate limit exceeded for OCR requests. Please wait a moment.".to_string(),
        ));
    }

    // Security check: Ensure the keys start with the user ID to prevent IDOR
    let user_id_prefix = format!("{}/", session.user.id);
    if !payload.key.starts_with(&user_id_prefix) {
        tracing::warn!(
            "🔒 Potential IDOR attempt by user {} for key {}",
            session.user.id,
            payload.key
        );
        return Err(ApiError::Unauthorized(
            "You do not have permission to access this file".to_string(),
        ));
    }

    if let Some(ref raw_key) = payload.raw_key
        && !raw_key.starts_with(&user_id_prefix)
    {
        tracing::warn!(
            "🔒 Potential IDOR attempt by user {} for raw_key {}",
            session.user.id,
            raw_key
        );
        return Err(ApiError::Unauthorized(
            "You do not have permission to access this file".to_string(),
        ));
    }

    // 1. Create a record in ocr_jobs table (QUEUED)
    let auto_confirm = payload.auto_confirm.unwrap_or(false);
    let trace_id = uuid::Uuid::now_v7().to_string();

    let job = state
        .core
        .ocr_manager
        .start_job(ocr::OcrJobCreateParams {
            user_id: session.user.id.clone(),
            trace_id: Some(trace_id),
            key: payload.key.clone(),
            raw_key: payload.raw_key.clone(),
            p_hash: payload.p_hash.clone(),
            auto_confirm,
            wallet_id: payload.wallet_id.clone(),
            category_id: payload.category_id.clone(),
            batch_id: payload.batch_id.clone(),
            idempotency_key,
        })
        .await?;
    let job_id = job.id.clone();

    // If the job is already COMPLETED (from pHash match), return early
    if job.status == "COMPLETED" {
        return Ok((
            StatusCode::OK,
            Json(OcrJobResponse {
                job_id,
                status: job.status,
            }),
        ));
    }

    // 2. Trigger processing immediately
    state
        .core
        .ocr_manager
        .process_immediately(Arc::new(state.core.clone()), job_id.clone())
        .await;

    Ok((
        StatusCode::ACCEPTED,
        Json(OcrJobResponse {
            job_id,
            status: "QUEUED".to_string(),
        }),
    ))
}

pub async fn get_ocr_job_status_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(job_id): Path<String>,
) -> Result<Json<db::entities::ocr_jobs::Model>, ApiError> {
    let job = ocr::get_ocr_job(&state.core.db, &job_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("OCR Job not found".to_string()))?;

    if job.user_id != session.user.id {
        tracing::warn!(
            "🔒 Potential IDOR attempt by user {} for job {}",
            session.user.id,
            job_id
        );
        return Err(ApiError::Unauthorized(
            "You do not have permission to access this job".to_string(),
        ));
    }

    Ok(Json(job))
}

pub async fn list_pending_ocr_jobs_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Vec<db::entities::ocr_jobs::Model>>, ApiError> {
    let jobs = ocr::list_pending_ocr_jobs(&state.core.db, &session.user.id).await?;
    Ok(Json(jobs))
}

pub async fn confirm_ocr_job_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(job_id): Path<String>,
    Json(payload): Json<ConfirmOcrRequest>,
) -> Result<Json<db::OcrTransactionResponse>, ApiError> {
    let result = state
        .core
        .ocr_manager
        .confirm_job(
            Arc::new(state.core.clone()),
            &session.user.id,
            &job_id,
            payload.manual_data,
        )
        .await?;
    Ok(Json(result))
}

pub async fn bulk_confirm_ocr_jobs_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Json(payload): Json<BulkConfirmOcrRequest>,
) -> Result<StatusCode, ApiError> {
    state
        .core
        .jobs
        .enqueue(
            crate::background_tasks::BulkConfirmOcrJob {
                user_id: session.user.id.clone(),
                job_ids: payload.job_ids,
            },
            Some(session.user.id),
            None,
        )
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(StatusCode::ACCEPTED)
}

pub async fn resolve_ocr_job_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(job_id): Path<String>,
    Json(payload): Json<ResolveContactRequest>,
) -> Result<Json<db::OcrTransactionResponse>, ApiError> {
    let result = state
        .core
        .ocr_manager
        .resolve_collision(
            Arc::new(state.core.clone()),
            &session.user.id,
            &job_id,
            &payload.contact_id,
        )
        .await?;
    Ok(Json(result))
}
