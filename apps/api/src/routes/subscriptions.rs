use axum::Router;
use axum::extract::{Json, Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post};
use db::entities::enums::{AlertChannel, SubscriptionCycle};
use serde::Deserialize;

use crate::middleware::error::ApiError;
use crate::{AppState, AuthSession};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(list_confirmed_subscriptions_handler).post(confirm_subscription_handler),
        )
        .route("/detect", get(detect_subscriptions_handler))
        .route("/{id}", delete(stop_tracking_subscription_handler))
        .route("/{id}/alerts", post(configure_subscription_alert_handler))
}

pub async fn list_confirmed_subscriptions_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Vec<db::entities::subscriptions::Model>>, ApiError> {
    let result = state
        .core
        .subscriptions
        .list_confirmed(&session.user.id)
        .await?;
    Ok(Json(result))
}

pub async fn detect_subscriptions_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Vec<db::entities::subscriptions::Model>>, ApiError> {
    let result = state.core.subscriptions.detect(&session.user.id).await?;

    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct ConfirmSubscriptionRequest {
    pub name: String,
    pub amount: rust_decimal::Decimal,
    pub cycle: SubscriptionCycle,
    pub start_date: chrono::DateTime<chrono::FixedOffset>,
    pub next_charge_date: chrono::DateTime<chrono::FixedOffset>,
    pub keywords: Option<serde_json::Value>,
}

pub async fn confirm_subscription_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Json(payload): Json<ConfirmSubscriptionRequest>,
) -> Result<Json<db::entities::subscriptions::Model>, ApiError> {
    let result = state
        .core
        .subscriptions
        .confirm(keiri_core::subscriptions::ops::ConfirmSubscriptionParams {
            user_id: session.user.id.clone(),
            name: payload.name,
            amount: payload.amount,
            cycle: payload.cycle,
            start_date: payload.start_date,
            next_charge_date: payload.next_charge_date,
            keywords: payload.keywords,
        })
        .await?;
    Ok(Json(result))
}

pub async fn stop_tracking_subscription_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state
        .core
        .subscriptions
        .stop_tracking(&session.user.id, &id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct ConfigureAlertRequest {
    pub days_before: i32,
    pub channel: AlertChannel,
}

pub async fn configure_subscription_alert_handler(
    State(state): State<AppState>,
    _session: AuthSession,
    Path(id): Path<String>,
    Json(payload): Json<ConfigureAlertRequest>,
) -> Result<Json<db::entities::sub_alerts::Model>, ApiError> {
    let result = state
        .core
        .subscriptions
        .configure_alert(&id, payload.days_before, payload.channel)
        .await?;
    Ok(Json(result))
}
