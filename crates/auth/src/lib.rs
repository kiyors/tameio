use axum::{
    extract::{FromRef, FromRequestParts},
    http::{StatusCode, request::Parts},
};
use better_auth::plugins::{EmailPasswordPlugin, SessionManagementPlugin};
use better_auth::{AuthBuilder, AuthConfig, AuthRequest, BetterAuth, HttpMethod};
use moka::future::Cache;
use sea_orm::DatabaseConnection;
use std::collections::HashMap;
use std::env;
use std::sync::{Arc, LazyLock};
use std::time::Duration;

pub mod adapter;
use crate::adapter::PostgresAdapter;

pub struct AuthSession {
    pub user: better_auth::types_mod::User,
}

/// Process-wide cache of resolved sessions keyed by the raw cookie + authorization
/// header values. Better-auth's session lookup hits Postgres on every request; this
/// short-lived cache absorbs the common case where a single client makes many
/// requests in quick succession. TTL is intentionally short so revoked sessions
/// stop authenticating quickly.
static SESSION_CACHE: LazyLock<Cache<String, better_auth::types_mod::User>> = LazyLock::new(|| {
    let ttl_secs = env::var("AUTH_SESSION_CACHE_TTL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(60);
    let capacity = env::var("AUTH_SESSION_CACHE_CAPACITY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10_000);
    Cache::builder()
        .max_capacity(capacity)
        .time_to_live(Duration::from_secs(ttl_secs))
        .build()
});

fn session_cache_key(headers: &axum::http::HeaderMap) -> Option<String> {
    let cookie = headers.get("cookie").and_then(|v| v.to_str().ok());
    let auth = headers.get("authorization").and_then(|v| v.to_str().ok());
    match (cookie, auth) {
        (None, None) => None,
        (c, a) => Some(format!("{}|{}", c.unwrap_or(""), a.unwrap_or(""))),
    }
}

impl<S> FromRequestParts<S> for AuthSession
where
    S: Send + Sync,
    Arc<BetterAuth<PostgresAdapter>>: FromRef<S>,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let cache_key = session_cache_key(&parts.headers);

        if let Some(ref key) = cache_key
            && let Some(user) = SESSION_CACHE.get(key).await
        {
            return Ok(AuthSession { user });
        }

        let auth = Arc::from_ref(state);

        let mut mapped_headers = HashMap::with_capacity(parts.headers.len());
        for (name, value) in parts.headers.iter() {
            if let Ok(val_str) = value.to_str() {
                mapped_headers.insert(name.as_str().to_owned(), val_str.to_owned());
            }
        }

        let auth_req = AuthRequest::from_parts(
            HttpMethod::Get,
            "/get-session".to_string(),
            mapped_headers,
            None,
            HashMap::new(),
        );

        let response = auth.handle_request(auth_req).await.map_err(|e| {
            tracing::error!("Better-Auth handle_request error: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

        if response.status != 200 {
            tracing::debug!(
                "Better-Auth session check failed with status: {}",
                response.status
            );
            return Err((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()));
        }

        let full_body: serde_json::Value = serde_json::from_slice(&response.body).map_err(|e| {
            tracing::error!(
                "Failed to parse body as Value: {}. Body: {:?}",
                e,
                String::from_utf8_lossy(&response.body)
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Invalid JSON from auth".to_string(),
            )
        })?;

        #[derive(serde::Deserialize)]
        struct SessionResponse {
            user: better_auth::types_mod::User,
        }

        let session_data: SessionResponse = serde_json::from_value(full_body).map_err(|e| {
            tracing::error!("Failed to parse session from Value: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse session: {}", e),
            )
        })?;

        tracing::debug!(
            "🔑 Auth Session extracted for user: {}",
            session_data.user.email.as_deref().unwrap_or("unknown")
        );

        if let Some(key) = cache_key {
            SESSION_CACHE.insert(key, session_data.user.clone()).await;
        }

        Ok(AuthSession {
            user: session_data.user,
        })
    }
}

pub async fn init_auth(
    db: Arc<DatabaseConnection>,
    auth_secret: String,
    base_url: String,
) -> Result<Arc<BetterAuth<PostgresAdapter>>, Box<dyn std::error::Error>> {
    let cors_origin = env::var("CORS_ORIGIN").unwrap_or_default();

    let is_production = env::var("APP_ENV").unwrap_or_default() == "production"
        || env::var("NODE_ENV").unwrap_or_default() == "production";

    let mut trusted_origins = Vec::new();

    if !is_production {
        trusted_origins.extend(vec![
            "http://localhost:3000".to_string(),
            "http://127.0.0.1:3000".to_string(),
            "http://localhost:8080".to_string(),
            "http://127.0.0.1:8080".to_string(),
            "http://localhost:8081".to_string(),
            "http://127.0.0.1:8081".to_string(),
        ]);
    }

    trusted_origins.push(base_url.clone());

    if !cors_origin.is_empty() {
        trusted_origins.extend(cors_origin.split(',').map(|s| s.trim().to_string()));
    }

    trusted_origins.sort();
    trusted_origins.dedup();

    let adapter = PostgresAdapter::new(db);

    let enable_signup = env::var("ENABLE_SIGNUP")
        .map(|v| v != "false")
        .unwrap_or(true);

    let require_email_verification = env::var("REQUIRE_EMAIL_VERIFICATION")
        .map(|v| v != "false")
        .unwrap_or(false);

    let auth_instance = AuthBuilder::new(
        AuthConfig::new(auth_secret)
            .base_url(base_url)
            .trusted_origins(trusted_origins),
    )
    .database(adapter)
    .plugin(
        EmailPasswordPlugin::new()
            .enable_signup(enable_signup)
            .require_email_verification(require_email_verification),
    )
    .plugin(SessionManagementPlugin::new())
    .build()
    .await?;

    Ok(Arc::new(auth_instance))
}
