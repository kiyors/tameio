use std::collections::HashSet;

use db::AppError;
use db::entities;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QuerySelect, Set,
};

#[allow(clippy::missing_errors_doc)]
pub async fn ensure_system_categories(db: &DatabaseConnection) -> Result<(), AppError> {
    // Ensure a "system" user exists so the FK constraint is satisfied
    let system_user = entities::users::Entity::find_by_id("system".to_string())
        .one(db)
        .await?;
    if system_user.is_none() {
        let now = chrono::Utc::now().fixed_offset();
        let user = entities::users::ActiveModel {
            id: Set("system".to_string()),
            name: Set("System".to_string()),
            email: Set("system@keiri.internal".to_string()),
            email_verified: Set(true),
            is_active: Set(false),
            created_at: Set(now),
            updated_at: Set(now),
            username: Set(Some("system".to_string())),
            display_username: Set(Some("System".to_string())),
            ..Default::default()
        };
        user.insert(db).await?;
    }

    let system_cats = vec![
        ("cat-sub-0001", "Subscription", "calendar", "#3b82f6"),
        ("cat-rnt-0002", "Rent & EMI", "home", "#8b5cf6"),
        ("cat-fod-0003", "Food & Dining", "coffee", "#f97316"),
        ("cat-trn-0004", "Transport", "car", "#eab308"),
        ("cat-ent-0005", "Entertainment", "tv", "#ec4899"),
        ("cat-gro-0006", "Groceries", "shopping-cart", "#10b981"),
        ("cat-hth-0007", "Health & Medical", "activity", "#ef4444"),
    ];

    // `id` is `&&str` (tuple binding through iter); dereference once so we hit
    // the fast `str -> String` specialization rather than the slow `&str ->
    // String` blanket impl (clippy::inefficient_to_string, gated by -D warnings
    // on rustc 1.91+).
    let ids: Vec<String> = system_cats
        .iter()
        .map(|(id, ..)| (*id).to_string())
        .collect();

    let existing_ids: HashSet<String> = entities::categories::Entity::find()
        .filter(entities::categories::Column::Id.is_in(ids))
        .select_only()
        .column(entities::categories::Column::Id)
        .into_tuple::<String>()
        .all(db)
        .await?
        .into_iter()
        .collect();

    let to_insert: Vec<entities::categories::ActiveModel> = system_cats
        .into_iter()
        .filter(|(id, ..)| !existing_ids.contains(*id))
        .map(
            |(id, name, icon, color)| entities::categories::ActiveModel {
                id: Set(id.to_string()),
                user_id: Set("system".to_string()),
                name: Set(name.to_string()),
                icon: Set(Some(icon.to_string())),
                color: Set(Some(color.to_string())),
            },
        )
        .collect();

    if !to_insert.is_empty() {
        entities::categories::Entity::insert_many(to_insert)
            .exec(db)
            .await?;
    }
    Ok(())
}
