use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, patch},
};
use db::dto::{CreateBudgetRequest, UpdateBudgetRequest};
use keiri_core::auth::AuthSession;

use crate::AppState;
use crate::extractors::ValidatedJson;
use crate::middleware::error::ApiError;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_budgets_handler).post(create_budget_handler))
        .route("/health", get(get_budgets_health_handler))
        .route(
            "/{id}",
            patch(update_budget_handler).delete(delete_budget_handler),
        )
}

async fn create_budget_handler(
    State(state): State<AppState>,
    session: AuthSession,
    ValidatedJson(payload): ValidatedJson<CreateBudgetRequest>,
) -> Result<Json<db::entities::budgets::Model>, ApiError> {
    let budget = state
        .core
        .budgets
        .create(
            &session.user.id,
            payload.category_id,
            payload.amount,
            payload.period,
        )
        .await?;
    Ok(Json(budget))
}

async fn list_budgets_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Vec<db::entities::budgets::Model>>, ApiError> {
    let budgets = state.core.budgets.list(&session.user.id).await?;
    Ok(Json(budgets))
}

async fn update_budget_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
    ValidatedJson(payload): ValidatedJson<UpdateBudgetRequest>,
) -> Result<Json<db::entities::budgets::Model>, ApiError> {
    let budget = state
        .core
        .budgets
        .update(&session.user.id, &id, payload.amount, payload.period)
        .await?;
    Ok(Json(budget))
}

async fn delete_budget_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
) -> Result<Json<u64>, ApiError> {
    let affected = state.core.budgets.delete(&session.user.id, &id).await?;
    Ok(Json(affected))
}

async fn get_budgets_health_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Vec<keiri_core::budgets::BudgetHealth>>, ApiError> {
    let health = state
        .core
        .budgets
        .get_all_budget_health(&session.user.id)
        .await?;
    Ok(Json(health))
}
