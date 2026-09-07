use axum::Router;
use axum::extract::{Json, Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use db::dto::{
    AddIdentifierRequest, CreateContactRequest, MergeContactsRequest, PaginationParams,
    UpdateContactRequest,
};

use crate::extractors::ValidatedJson;
use crate::middleware::error::ApiError;
use crate::{AppState, AuthSession};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_contacts_handler).post(create_contact_handler))
        .route("/suggestions", get(get_merge_suggestions_handler))
        .route("/merge", post(merge_contacts_handler))
        .route(
            "/{id}",
            get(get_contact_detail_handler)
                .put(update_contact_handler)
                .delete(delete_contact_handler),
        )
        .route("/{id}/identifiers", post(add_contact_identifier_handler))
}

pub async fn list_contacts_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<db::entities::contacts::Model>>, ApiError> {
    let result = state
        .core
        .contacts
        .list(&session.user.id, Some(params.safe_limit()), params.offset)
        .await?;
    Ok(Json(result))
}

pub async fn create_contact_handler(
    State(state): State<AppState>,
    session: AuthSession,
    ValidatedJson(payload): ValidatedJson<CreateContactRequest>,
) -> Result<Json<db::entities::contacts::Model>, ApiError> {
    let result = state
        .core
        .contacts
        .create(&session.user.id, &payload.name, payload.phone)
        .await?;
    Ok(Json(result))
}

pub async fn update_contact_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
    ValidatedJson(payload): ValidatedJson<UpdateContactRequest>,
) -> Result<Json<db::entities::contacts::Model>, ApiError> {
    let result = state
        .core
        .contacts
        .update(
            &session.user.id,
            &id,
            payload.name,
            payload.phone,
            payload.is_pinned,
        )
        .await?;
    Ok(Json(result))
}

pub async fn delete_contact_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.core.contacts.delete(&session.user.id, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_contact_detail_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
) -> Result<Json<db::ContactDetail>, ApiError> {
    let detail = state
        .core
        .contacts
        .get_detail(&session.user.id, &id)
        .await?;
    Ok(Json(detail))
}

pub async fn add_contact_identifier_handler(
    State(state): State<AppState>,
    session: AuthSession,
    Path(id): Path<String>,
    ValidatedJson(payload): ValidatedJson<AddIdentifierRequest>,
) -> Result<Json<db::entities::contact_identifiers::Model>, ApiError> {
    let result = state
        .core
        .contacts
        .add_identifier(&session.user.id, &id, payload.r#type, payload.value)
        .await?;
    Ok(Json(result))
}

pub async fn get_merge_suggestions_handler(
    State(state): State<AppState>,
    session: AuthSession,
) -> Result<Json<Vec<keiri_core::contacts::ops::MergeSuggestion>>, ApiError> {
    let result = state
        .core
        .contacts
        .get_merge_suggestions(&session.user.id)
        .await?;
    Ok(Json(result))
}

pub async fn merge_contacts_handler(
    State(state): State<AppState>,
    session: AuthSession,
    ValidatedJson(payload): ValidatedJson<MergeContactsRequest>,
) -> Result<Json<db::entities::contacts::Model>, ApiError> {
    let result = state
        .core
        .contacts
        .merge(&session.user.id, &payload.primary_id, &payload.secondary_id)
        .await?;

    Ok(Json(result))
}
