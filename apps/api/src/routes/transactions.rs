use axum::Router;
use axum::extract::{Json, Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, patch, post};
use db::dto::{
    CreateManualTransactionRequest, PaginationParams, SplitTransactionRequest,
    UpdateTransactionRequest,
};
use keiri_core::ocr::OcrProcessor;

use crate::middleware::error::ApiError;
use crate::{AppState, AuthSession};

use crate::extractors::ValidatedJson;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_transactions_handler))
        .route("/summary", get(get_summary_handler))
        .route("/manual", post(create_manual_transaction_handler))
        .route("/from-ocr", post(create_from_ocr_handler))
        .route("/{id}", patch(update_transaction_handler))
        .route("/{id}", delete(delete_transaction_handler))
        .route("/split", post(split_transaction_handler))
}

pub async fn create_manual_transaction_handler(
    State(state): State<AppState>,
    session: AuthSession,
    ValidatedJson(payload): ValidatedJson<CreateManualTransactionRequest>,
) -> Result<Json<db::entities::transactions::Model>, ApiError> {
    let result = state
        .core
        .transactions
        .create(
            &session.user.id,
            payload.amount,
            payload.direction,
            payload.date,
            db::entities::enums::TransactionSource::Manual,
            Some(payload.purpose_tag),
            payload.category_id,
            payload.source_wallet_id,
            payload.destination_wallet_id,
            payload.contact_id,
            payload.notes,
        )
        .await?;

    Ok(Json(result))
}

pub async fn list_transactions_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Query(params): Query<PaginationParams>,
) -> Result<Json<db::PaginatedTransactions>, ApiError> {
    let result = state
        .core
        .transactions
        .list(&session.user.id, Some(params.safe_limit()), params.offset)
        .await?;
    Ok(Json(result))
}

pub async fn get_summary_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<db::DashboardSummary>, ApiError> {
    let result = state
        .core
        .transactions
        .get_summary(&session.user.id)
        .await?;
    Ok(Json(result))
}

pub async fn create_from_ocr_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Json(payload): Json<keiri_core::ProcessedOcr>,
) -> Result<Json<keiri_core::OcrTransactionResponse>, ApiError> {
    let result = state
        .core
        .process_ocr(&state.core.db, &session.user.id, payload)
        .await?;
    Ok(Json(result))
}

pub async fn update_transaction_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
    Json(payload): Json<UpdateTransactionRequest>,
) -> Result<Json<db::entities::transactions::Model>, ApiError> {
    let result = state
        .core
        .transactions
        .update(
            &session.user.id,
            &id,
            payload.amount,
            payload.date,
            payload.purpose_tag,
            payload.category_id,
            payload.status,
            payload.notes,
            payload.source_wallet_id,
            payload.destination_wallet_id,
            payload.contact_id,
        )
        .await?;

    Ok(Json(result))
}

pub async fn delete_transaction_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state
        .core
        .transactions
        .delete(&session.user.id, &id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn split_transaction_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Json(payload): Json<SplitTransactionRequest>,
) -> Result<Json<Vec<db::entities::p2p_requests::Model>>, ApiError> {
    let result = state
        .core
        .transactions
        .split(&session.user.id, &payload.transaction_id, payload.splits)
        .await?;

    Ok(Json(result))
}
