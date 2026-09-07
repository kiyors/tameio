use axum::{Json, Router, extract::State, http::StatusCode, response::IntoResponse, routing::get};
use serde::Serialize;
use serde_json::json;

use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/live", get(live_handler))
        .route("/ready", get(ready_handler))
}

/// Liveness probe: process is alive and the runtime is responsive.
///
/// Intentionally cheap — no I/O. Kubernetes / load balancers should poll this
/// frequently; a 5xx here means "restart me".
pub async fn live_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(json!({ "status": "live", "version": env!("CARGO_PKG_VERSION") })),
    )
}

#[derive(Serialize)]
struct ProbeCheck {
    name: &'static str,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

/// Readiness probe: dependencies the API needs to actually serve traffic are
/// reachable. Returns 200 only when both the database and object store
/// respond; otherwise 503 with a per-check breakdown so the operator can see
/// which dependency is down.
pub async fn ready_handler(State(state): State<AppState>) -> impl IntoResponse {
    use keiri_core::sea_orm::ConnectionTrait;

    // DB: cheapest possible round-trip; `SELECT 1` against the configured
    // backend. SeaORM's `ping` would also work but goes through the connection
    // pool the same way.
    let db_backend = state.core.db.get_database_backend();
    let db_check = state
        .core
        .db
        .execute(keiri_core::sea_orm::Statement::from_string(
            db_backend,
            "SELECT 1".to_string(),
        ))
        .await;
    let db = ProbeCheck {
        name: "database",
        ok: db_check.is_ok(),
        error: db_check.err().map(|e| e.to_string()),
    };

    // Object store: `HeadBucket` against the configured S3/R2 bucket. Cheap,
    // doesn't transfer any object data, and surfaces credential / DNS issues.
    let s3_check = state.core.upload_client.health_check().await;
    let s3 = ProbeCheck {
        name: "object_store",
        ok: s3_check.is_ok(),
        error: s3_check.err().map(|e| e.to_string()),
    };

    let all_ok = db.ok && s3.ok;
    let status = if all_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        status,
        Json(json!({
            "status": if all_ok { "ready" } else { "not_ready" },
            "checks": [db, s3],
        })),
    )
}
