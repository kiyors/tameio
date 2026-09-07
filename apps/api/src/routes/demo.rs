use crate::middleware::error::ApiError;
use crate::{AppState, AuthSession};
use axum::Json;
use axum::Router;
use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::{get, post};
use keiri_core::services::demo;
use serde::Serialize;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/status", get(get_demo_status_handler))
        .route("/seed", post(seed_demo_data_handler))
        .route("/clear", post(clear_demo_data_handler))
}

#[derive(Serialize)]
pub struct DemoStatusResponse {
    pub active: bool,
}

pub async fn get_demo_status_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<DemoStatusResponse>, ApiError> {
    let active = demo::get_demo_status(&state.core, &session.user.id)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to get demo status: {:?}", e)))?;
    Ok(Json(DemoStatusResponse { active }))
}

pub async fn seed_demo_data_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<StatusCode, ApiError> {
    demo::seed_demo_data(&state.core, &session.user.id)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to seed demo data: {:?}", e)))?;
    Ok(StatusCode::CREATED)
}

pub async fn clear_demo_data_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<StatusCode, ApiError> {
    demo::clear_demo_data(&state.core, &session.user.id)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to clear demo data: {:?}", e)))?;
    Ok(StatusCode::NO_CONTENT)
}
