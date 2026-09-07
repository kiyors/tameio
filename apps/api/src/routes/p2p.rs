use axum::Router;
use axum::extract::{Json, Path, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use serde::Deserialize;

use crate::middleware::error::ApiError;
use crate::{AppState, AuthSession};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/pending", get(list_pending_p2p_handler))
        .route("/create", post(create_p2p_handler))
        .route("/accept", post(accept_p2p_handler))
        .route("/reject/{id}", post(reject_p2p_handler))
        .route("/ledger-tabs", get(list_ledger_tabs_handler))
        .route("/ledger-tabs", post(create_ledger_tab_handler))
        .route(
            "/ledger-tabs/{id}/repayment",
            post(register_repayment_handler),
        )
}

pub async fn list_pending_p2p_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Vec<db::P2pRequestWithSender>>, ApiError> {
    let email = session
        .user
        .email
        .clone()
        .ok_or_else(|| ApiError::BadRequest("Email missing".to_string()))?;
    let result = state.core.groups.list_pending_p2p_requests(&email).await?;

    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct CreateP2PRequest {
    pub receiver_email: String,
    pub transaction_id: String,
}

pub async fn create_p2p_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Json(payload): Json<CreateP2PRequest>,
) -> Result<Json<db::entities::p2p_requests::Model>, ApiError> {
    let result = state
        .core
        .groups
        .create_p2p_request(
            &session.user.id,
            &payload.receiver_email,
            &payload.transaction_id,
        )
        .await?;

    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct AcceptP2PRequest {
    pub request_id: String,
}

pub async fn accept_p2p_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Json(payload): Json<AcceptP2PRequest>,
) -> Result<Json<db::entities::p2p_requests::Model>, ApiError> {
    let email = session
        .user
        .email
        .clone()
        .ok_or_else(|| ApiError::BadRequest("Email missing".to_string()))?;

    let result = state
        .core
        .groups
        .accept_p2p_request(&session.user.id, &email, &payload.request_id)
        .await?;

    Ok(Json(result))
}

pub async fn reject_p2p_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let email = session
        .user
        .email
        .clone()
        .ok_or_else(|| ApiError::BadRequest("Email missing".to_string()))?;

    state
        .core
        .groups
        .reject_p2p_request(&session.user.id, &email, &id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct CreateLedgerTabRequest {
    pub counterparty_id: Option<String>,
    pub tab_type: db::entities::enums::LedgerTabType,
    pub title: String,
    pub description: Option<String>,
    pub target_amount: rust_decimal::Decimal,
}

pub async fn create_ledger_tab_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Json(payload): Json<CreateLedgerTabRequest>,
) -> Result<Json<db::entities::ledger_tabs::Model>, ApiError> {
    let result = state
        .core
        .groups
        .create_ledger_tab(
            &session.user.id,
            payload.counterparty_id,
            payload.tab_type,
            &payload.title,
            payload.description,
            payload.target_amount,
        )
        .await?;
    Ok(Json(result))
}

pub async fn list_ledger_tabs_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Vec<db::entities::ledger_tabs::Model>>, ApiError> {
    use keiri_core::sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
    let result = db::entities::ledger_tabs::Entity::find()
        .filter(db::entities::ledger_tabs::Column::CreatorId.eq(&session.user.id))
        .all(&*state.core.db)
        .await?;
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct RegisterRepaymentRequest {
    pub amount: rust_decimal::Decimal,
    pub source_wallet_id: Option<String>,
}

pub async fn register_repayment_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
    Json(payload): Json<RegisterRepaymentRequest>,
) -> Result<Json<db::entities::transactions::Model>, ApiError> {
    let result = state
        .core
        .groups
        .register_repayment(
            &session.user.id,
            &id,
            payload.amount,
            payload.source_wallet_id,
        )
        .await?;
    Ok(Json(result))
}
