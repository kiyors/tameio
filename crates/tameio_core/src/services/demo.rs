use crate::Core;
use db::entities::{
    budgets, categories, contact_links, contacts, enums::BudgetPeriod, enums::TransactionDirection,
    enums::TransactionSource, enums::TransactionStatus, transactions, users, wallets,
};
use rust_decimal::Decimal;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set, TransactionTrait};

/// Gets the demo status for the user.
///
/// # Errors
/// Returns an error if the database query fails.
pub async fn get_demo_status(
    core: &Core,
    user_id: &str,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let user = users::Entity::find_by_id(user_id.to_string())
        .one(core.db.as_ref())
        .await?;

    if let Some(u) = user
        && let Some(metadata) = u.metadata
        && let Some(active) = metadata
            .get("demo_active")
            .and_then(serde_json::Value::as_bool)
    {
        return Ok(active);
    }

    Ok(false)
}

/// Seeds demo data for the user.
///
/// # Errors
/// Returns an error if any database operation fails.
///
/// # Panics
/// Panics if the hardcoded decimal strings fail to parse.
#[allow(clippy::too_many_lines)]
pub async fn seed_demo_data(
    core: &Core,
    user_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let txn = core.db.begin().await?;

    // Create 3 Wallets
    let wallet_1 = wallets::ActiveModel {
        id: Set(uuid::Uuid::now_v7().to_string()),
        user_id: Set(user_id.to_string()),
        name: Set("HDFC Bank Account".to_string()),
        balance: Set(Decimal::from(45000)),
        r#type: Set(db::entities::enums::WalletType::Bank),
        ..Default::default()
    }
    .insert(&txn)
    .await?;

    let wallet_2 = wallets::ActiveModel {
        id: Set(uuid::Uuid::now_v7().to_string()),
        user_id: Set(user_id.to_string()),
        name: Set("ICICI Credit Card".to_string()),
        balance: Set(Decimal::from(-12500)),
        r#type: Set(db::entities::enums::WalletType::CreditCard),
        ..Default::default()
    }
    .insert(&txn)
    .await?;

    let wallet_3 = wallets::ActiveModel {
        id: Set(uuid::Uuid::now_v7().to_string()),
        user_id: Set(user_id.to_string()),
        name: Set("Cash".to_string()),
        balance: Set(Decimal::from(3200)),
        r#type: Set(db::entities::enums::WalletType::Cash),
        ..Default::default()
    }
    .insert(&txn)
    .await?;

    let wallet_ids = [&wallet_1.id, &wallet_2.id, &wallet_3.id];

    // Create 8 Categories
    let category_names = [
        "Food",
        "Transport",
        "Shopping",
        "Entertainment",
        "Bills",
        "Salary",
        "Freelance",
        "Rent",
    ];
    let mut category_models = Vec::new();
    let mut inserted_categories = Vec::new();

    for name in category_names {
        let cat = categories::ActiveModel {
            id: Set(uuid::Uuid::now_v7().to_string()),
            user_id: Set(user_id.to_string()),
            name: Set(name.to_string()),
            icon: Set(Some("tag".to_string())),
            color: Set(Some("#3b82f6".to_string())),
        };
        inserted_categories.push(cat.id.as_ref().clone());
        category_models.push(cat);
    }
    categories::Entity::insert_many(category_models)
        .exec(&txn)
        .await?;

    // Create 3 Budgets
    let mut budget_models = Vec::new();
    let budget_data = [
        (&inserted_categories[0], 8000),
        (&inserted_categories[1], 3000),
        (&inserted_categories[2], 5000),
    ];
    let now_naive = chrono::Utc::now().naive_utc();
    let now_tz: chrono::DateTime<chrono::FixedOffset> = chrono::Utc::now().into();

    for (cat_id, amount) in budget_data {
        budget_models.push(budgets::ActiveModel {
            id: Set(uuid::Uuid::now_v7().to_string()),
            user_id: Set(user_id.to_string()),
            category_id: Set(Some(cat_id.clone())),
            amount: Set(Decimal::from(amount)),
            period: Set(BudgetPeriod::Monthly),
            created_at: Set(now_naive),
            updated_at: Set(now_naive),
        });
    }
    budgets::Entity::insert_many(budget_models)
        .exec(&txn)
        .await?;

    // Create 4 Contacts
    let contact_names = ["John Doe", "Jane Smith", "Alice", "Bob"];
    let mut contact_models = Vec::new();
    let mut link_models = Vec::new();

    for name in contact_names {
        let c_id = uuid::Uuid::now_v7().to_string();
        contact_models.push(contacts::ActiveModel {
            id: Set(c_id.clone()),
            name: Set(name.to_string()),
            ..Default::default()
        });
        link_models.push(contact_links::ActiveModel {
            user_id: Set(user_id.to_string()),
            contact_id: Set(c_id),
        });
    }
    contacts::Entity::insert_many(contact_models)
        .exec(&txn)
        .await?;
    contact_links::Entity::insert_many(link_models)
        .exec(&txn)
        .await?;

    // Create 20 Transactions
    let mut txns = Vec::new();

    for i in 0..20 {
        let is_income = i % 5 == 0;
        let amount = if is_income {
            Decimal::from(15000)
        } else {
            Decimal::from((i + 1) * 100)
        };

        let cat_idx = i % inserted_categories.len();
        let w_index = i % wallet_ids.len();

        let mut txn_model = transactions::ActiveModel {
            id: Set(uuid::Uuid::now_v7().to_string()),
            user_id: Set(user_id.to_string()),
            amount: Set(amount),
            direction: Set(if is_income {
                TransactionDirection::In
            } else {
                TransactionDirection::Out
            }),
            date: Set(now_tz),
            source: Set(TransactionSource::Manual),
            status: Set(TransactionStatus::Completed),
            category_id: Set(Some(inserted_categories[cat_idx].clone())),
            notes: Set(Some(format!("Demo transaction {i}"))),
            ..Default::default()
        };

        if is_income {
            txn_model.destination_wallet_id = Set(Some(wallet_ids[w_index].clone()));
        } else {
            txn_model.source_wallet_id = Set(Some(wallet_ids[w_index].clone()));
        }

        txns.push(txn_model);
    }
    transactions::Entity::insert_many(txns).exec(&txn).await?;

    // Set demo_active flag on User
    if let Some(user) = users::Entity::find_by_id(user_id.to_string())
        .one(&txn)
        .await?
    {
        let mut metadata = user
            .metadata
            .clone()
            .unwrap_or_else(|| serde_json::json!({}));
        if let Some(obj) = metadata.as_object_mut() {
            obj.insert("demo_active".to_string(), serde_json::json!(true));
        }

        let mut user_am: users::ActiveModel = user.into();
        user_am.metadata = Set(Some(metadata));
        user_am.update(&txn).await?;
    }

    txn.commit().await?;

    Ok(())
}

/// Clears the demo data for the user.
///
/// # Errors
/// Returns an error if any database operation fails.
pub async fn clear_demo_data(
    core: &Core,
    user_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let txn = core.db.begin().await?;

    transactions::Entity::delete_many()
        .filter(transactions::Column::UserId.eq(user_id.to_string()))
        .exec(&txn)
        .await?;

    wallets::Entity::delete_many()
        .filter(wallets::Column::UserId.eq(user_id.to_string()))
        .exec(&txn)
        .await?;

    categories::Entity::delete_many()
        .filter(categories::Column::UserId.eq(user_id.to_string()))
        .exec(&txn)
        .await?;

    budgets::Entity::delete_many()
        .filter(budgets::Column::UserId.eq(user_id.to_string()))
        .exec(&txn)
        .await?;

    // Need to find contacts via contact_links, delete links then contacts
    let links = contact_links::Entity::find()
        .filter(contact_links::Column::UserId.eq(user_id.to_string()))
        .all(&txn)
        .await?;

    let contact_ids: Vec<String> = links.into_iter().map(|l| l.contact_id).collect();

    contact_links::Entity::delete_many()
        .filter(contact_links::Column::UserId.eq(user_id.to_string()))
        .exec(&txn)
        .await?;

    if !contact_ids.is_empty() {
        contacts::Entity::delete_many()
            .filter(contacts::Column::Id.is_in(contact_ids))
            .exec(&txn)
            .await?;
    }

    // Unset demo_active flag on User
    if let Some(user) = users::Entity::find_by_id(user_id.to_string())
        .one(&txn)
        .await?
    {
        let mut metadata = user
            .metadata
            .clone()
            .unwrap_or_else(|| serde_json::json!({}));
        if let Some(obj) = metadata.as_object_mut() {
            obj.insert("demo_active".to_string(), serde_json::json!(false));
        }

        let mut user_am: users::ActiveModel = user.into();
        user_am.metadata = Set(Some(metadata));
        user_am.update(&txn).await?;
    }

    txn.commit().await?;

    Ok(())
}
