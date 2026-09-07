use axum::Router;
use axum::extract::{Json, Multipart, Path, State};
use axum::http::StatusCode;
use axum::routing::{get, post, put};
use keiri_core::upload::CompressOptions;
use serde::{Deserialize, Serialize};

use crate::middleware::error::ApiError;
use crate::{AppState, AuthSession};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/profile", put(update_profile_handler))
        .route("/avatar", post(upload_avatar_handler))
        .route(
            "/upi",
            get(list_user_upi_handler).post(add_user_upi_handler),
        )
        .route("/{id}/make-primary", put(make_primary_upi_handler))
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub name: Option<String>,
    pub username: Option<String>,
    pub image: Option<String>,
}

pub async fn update_profile_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<db::entities::users::Model>, ApiError> {
    let result = state
        .core
        .users
        .update_profile(
            &session.user.id,
            payload.name,
            payload.username,
            payload.image,
        )
        .await?;
    Ok(Json(result))
}

#[derive(Serialize)]
pub struct AvatarUploadResponse {
    pub url: String,
    pub key: String,
}

pub async fn upload_avatar_handler(
    State(state): State<AppState>,
    session: AuthSession,
    mut multipart: Multipart,
) -> Result<Json<AvatarUploadResponse>, ApiError> {
    tracing::debug!("📸 Avatar upload for user: {}", session.user.id);

    let mut file_data = None;
    let mut file_name = String::new();
    let mut content_type = String::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            file_name = field.file_name().unwrap_or("avatar").to_string();
            content_type = field.content_type().unwrap_or("image/png").to_string();

            // Validate it's an allowed image content type
            let allowed_types = [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif",
                "image/heic",
                "image/heif",
            ];
            if !allowed_types.contains(&content_type.as_str()) {
                return Err(ApiError::BadRequest(
                    "Only JPEG, PNG, WebP, GIF, and HEIC images are allowed for avatars"
                        .to_string(),
                ));
            }

            file_data = Some(field.bytes().await.map_err(|e| {
                ApiError::Internal(format!("Failed to read multipart bytes: {:?}", e))
            })?);
            break;
        }
    }

    let data = file_data.ok_or_else(|| ApiError::BadRequest("No file uploaded".to_string()))?;

    // Compress to WebP, max 512×512 for avatars
    let processed = state
        .core
        .upload_client
        .upload_compressed(
            &session.user.id,
            data,
            Some(file_name),
            Some(content_type),
            CompressOptions::avatar(),
        )
        .await
        .map_err(|e| ApiError::Internal(format!("Avatar upload failed: {:?}", e)))?;

    let r2_public_url = std::env::var("R2_PUBLIC_URL")
        .unwrap_or_else(|_| "https://pub-3e637dff099d43faa282edc2702dbf2c.r2.dev".to_string());
    let avatar_url = format!("{}/{}", r2_public_url, processed.key);

    // Save the avatar URL to the user's profile in the DB
    state
        .core
        .users
        .update_profile(&session.user.id, None, None, Some(avatar_url.clone()))
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to save avatar URL to DB: {:?}", e)))?;

    tracing::info!(
        "✅ Avatar uploaded for user {}: {}",
        session.user.id,
        avatar_url
    );

    Ok(Json(AvatarUploadResponse {
        url: avatar_url,
        key: processed.key,
    }))
}

pub async fn list_user_upi_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Vec<db::entities::user_upi_ids::Model>>, ApiError> {
    let result = state.core.users.list_upi(&session.user.id).await?;
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct AddUpiRequest {
    pub upi_id: String,
    pub label: Option<String>,
}

pub async fn add_user_upi_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Json(payload): Json<AddUpiRequest>,
) -> Result<Json<db::entities::user_upi_ids::Model>, ApiError> {
    let result = state
        .core
        .users
        .add_upi(&session.user.id, payload.upi_id, payload.label)
        .await?;
    Ok(Json(result))
}

pub async fn make_primary_upi_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state
        .core
        .users
        .make_primary_upi(&session.user.id, &id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
