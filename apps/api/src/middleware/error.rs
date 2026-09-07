use axum::{
    Json,
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde_json::json;
use thiserror::Error;

/// Suggested `Retry-After` value (in seconds) for rate-limited responses. Sized
/// to comfortably exceed the per-minute window the OCR limiter uses today.
const RATE_LIMIT_RETRY_AFTER_SECS: u32 = 60;

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("Internal Server Error: {0}")]
    Internal(String),
    #[error("Not Found: {0}")]
    NotFound(String),
    #[error("Bad Request: {0}")]
    BadRequest(String),
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    #[error("Too Many Requests: {0}")]
    RateLimited(String),
    #[error("Database error: {0}")]
    App(#[from] db::AppError),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        // Rate-limit responses are handled separately so they can carry a
        // Retry-After hint to clients (lets them back off intelligently
        // instead of immediately retrying and burning more of the quota).
        if let ApiError::RateLimited(msg) = self {
            let body = Json(json!({ "error": msg }));
            let retry_header_value =
                HeaderValue::from_str(&RATE_LIMIT_RETRY_AFTER_SECS.to_string())
                    .unwrap_or_else(|_| HeaderValue::from_static("60"));
            return (
                StatusCode::TOO_MANY_REQUESTS,
                [(header::RETRY_AFTER, retry_header_value)],
                body,
            )
                .into_response();
        }

        let (status, message) = match self {
            ApiError::Internal(msg) => {
                tracing::error!("Internal Server Error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "An internal error occurred".into(),
                )
            }
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            ApiError::RateLimited(_) => unreachable!("handled above"),
            ApiError::App(app_err) => match app_err {
                db::AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
                db::AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
                db::AppError::Validation(msg) => (StatusCode::BAD_REQUEST, msg),
                db::AppError::Ocr(msg) => (StatusCode::BAD_REQUEST, msg),
                _ => {
                    tracing::error!("Internal App Error: {:?}", app_err);
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "An internal error occurred".into(),
                    )
                }
            },
        };

        let body = Json(json!({
            "error": message,
        }));

        (status, body).into_response()
    }
}

use keiri_core::sea_orm::DbErr;

impl From<DbErr> for ApiError {
    fn from(err: DbErr) -> Self {
        ApiError::App(db::AppError::Db(err))
    }
}
