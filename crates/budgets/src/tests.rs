use super::*;
use ::db::entities::enums::{
    BudgetPeriod, TransactionDirection, TransactionSource, TransactionStatus,
};
use migration::{Migrator, MigratorTrait};
use rust_decimal_macros::dec;
use sea_orm::{Database, DatabaseConnection, EntityTrait, Set};
use std::sync::Arc;

async fn setup_test_db() -> Arc<DatabaseConnection> {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    Migrator::up(&db, None).await.unwrap();

    // Create system user
    let now = chrono::Utc::now();
    let system_user = db::entities::users::ActiveModel {
        id: Set("system".to_string()),
        email: Set("system@keiri.app".to_string()),
        name: Set("System".to_string()),
        created_at: Set(now.into()),
        updated_at: Set(now.into()),
        ..Default::default()
    };
    db::entities::users::Entity::insert(system_user)
        .exec(&db)
        .await
        .unwrap();

    Arc::new(db)
}

async fn create_test_user(db: &DatabaseConnection, id: &str) -> db::entities::users::Model {
    let now = chrono::Utc::now();
    let user = db::entities::users::ActiveModel {
        id: Set(id.to_string()),
        email: Set(format!("{id}@example.com")),
        name: Set(format!("User {id}")),
        created_at: Set(now.into()),
        updated_at: Set(now.into()),
        ..Default::default()
    };
    db::entities::users::Entity::insert(user)
        .exec(db)
        .await
        .unwrap();
    db::entities::users::Entity::find_by_id(id.to_string())
        .one(db)
        .await
        .unwrap()
        .unwrap()
}

#[tokio::test]
async fn test_budget_crud() {
    let db = setup_test_db().await;
    let user = create_test_user(&db, "user_1").await;
    let manager = BudgetsManager::new(db.clone());

    // 1. Create
    let budget = manager
        .create(&user.id, None, dec!(500), BudgetPeriod::Monthly)
        .await
        .unwrap();

    assert_eq!(budget.amount, dec!(500));
    assert_eq!(budget.period, BudgetPeriod::Monthly);

    // 2. List
    let budgets = manager.list(&user.id).await.unwrap();
    assert_eq!(budgets.len(), 1);

    // 3. Update
    let updated = manager
        .update(
            &user.id,
            &budget.id,
            Some(dec!(600)),
            Some(BudgetPeriod::Weekly),
        )
        .await
        .unwrap();
    assert_eq!(updated.amount, dec!(600));
    assert_eq!(updated.period, BudgetPeriod::Weekly);

    // 4. Delete
    let affected = manager.delete(&user.id, &budget.id).await.unwrap();
    assert_eq!(affected, 1);

    let budgets = manager.list(&user.id).await.unwrap();
    assert_eq!(budgets.len(), 0);
}

#[tokio::test]
async fn test_budget_health() {
    let db = setup_test_db().await;
    let user = create_test_user(&db, "user_1").await;
    let manager = BudgetsManager::new(db.clone());
    let now = Utc::now();

    // 1. Create Category
    let category = db::entities::categories::ActiveModel {
        id: Set("cat_1".to_string()),
        name: Set("Food".to_string()),
        user_id: Set("system".to_string()),
        ..Default::default()
    };
    db::entities::categories::Entity::insert(category)
        .exec(&*db)
        .await
        .unwrap();

    // 2. Create Budget for Food
    manager
        .create(
            &user.id,
            Some("cat_1".to_string()),
            dec!(1000),
            BudgetPeriod::Monthly,
        )
        .await
        .unwrap();

    // 3. Create Transactions
    // Transaction in Food (Should count)
    let txn1 = db::entities::transactions::ActiveModel {
        id: Set("txn_1".to_string()),
        user_id: Set(user.id.clone()),
        amount: Set(dec!(200)),
        direction: Set(TransactionDirection::Out),
        date: Set(now.into()),
        source: Set(TransactionSource::Manual),
        status: Set(TransactionStatus::Completed),
        category_id: Set(Some("cat_1".to_string())),
        ..Default::default()
    };
    db::entities::transactions::Entity::insert(txn1)
        .exec(&*db)
        .await
        .unwrap();

    // Transaction in another category (Should NOT count)
    let txn2 = db::entities::transactions::ActiveModel {
        id: Set("txn_2".to_string()),
        user_id: Set(user.id.clone()),
        amount: Set(dec!(300)),
        direction: Set(TransactionDirection::Out),
        date: Set(now.into()),
        source: Set(TransactionSource::Manual),
        status: Set(TransactionStatus::Completed),
        category_id: Set(None),
        ..Default::default()
    };
    db::entities::transactions::Entity::insert(txn2)
        .exec(&*db)
        .await
        .unwrap();

    // 4. Check Health
    let health = manager.get_all_budget_health(&user.id).await.unwrap();
    assert_eq!(health.len(), 1);
    assert_eq!(health[0].spent_amount, dec!(200));
    assert_eq!(health[0].limit_amount, dec!(1000));
    assert_eq!(health[0].remaining_amount, dec!(800));
    assert_eq!(health[0].percentage_consumed, dec!(20));
    assert_eq!(health[0].category_name, Some("Food".to_string()));
}

#[tokio::test]
async fn test_budget_health_mixed_categories() {
    // Verifies that an "all categories" budget and a category-specific budget
    // of the same period are computed independently from the same bucketed pass.
    let db = setup_test_db().await;
    let user = create_test_user(&db, "user_mix").await;
    let manager = BudgetsManager::new(db.clone());
    let now = Utc::now();

    let food = db::entities::categories::ActiveModel {
        id: Set("cat_food".to_string()),
        name: Set("Food".to_string()),
        user_id: Set("system".to_string()),
        ..Default::default()
    };
    db::entities::categories::Entity::insert(food)
        .exec(&*db)
        .await
        .unwrap();

    // Food-only monthly budget
    manager
        .create(
            &user.id,
            Some("cat_food".to_string()),
            dec!(1000),
            BudgetPeriod::Monthly,
        )
        .await
        .unwrap();

    // All-categories monthly budget
    manager
        .create(&user.id, None, dec!(2000), BudgetPeriod::Monthly)
        .await
        .unwrap();

    // 150 in Food, 300 uncategorised, 50 IN (should be ignored)
    for (id, amount, dir, cat) in [
        (
            "txn_food",
            dec!(150),
            TransactionDirection::Out,
            Some("cat_food"),
        ),
        ("txn_other", dec!(300), TransactionDirection::Out, None),
        ("txn_in", dec!(50), TransactionDirection::In, None),
    ] {
        let txn = db::entities::transactions::ActiveModel {
            id: Set(id.to_string()),
            user_id: Set(user.id.clone()),
            amount: Set(amount),
            direction: Set(dir),
            date: Set(now.into()),
            source: Set(TransactionSource::Manual),
            status: Set(TransactionStatus::Completed),
            category_id: Set(cat.map(str::to_string)),
            ..Default::default()
        };
        db::entities::transactions::Entity::insert(txn)
            .exec(&*db)
            .await
            .unwrap();
    }

    let health = manager.get_all_budget_health(&user.id).await.unwrap();
    let by_cat: std::collections::HashMap<Option<String>, rust_decimal::Decimal> = health
        .iter()
        .map(|h| {
            (
                if h.category_name.as_deref() == Some("All Categories") {
                    None
                } else {
                    h.category_name.clone()
                },
                h.spent_amount,
            )
        })
        .collect();
    // Food budget sees only the Food txn (150). All-categories sees both OUT
    // txns (150 + 300 = 450). IN txn is filtered at the SQL layer.
    assert_eq!(by_cat.get(&Some("Food".to_string())), Some(&dec!(150)));
    assert_eq!(by_cat.get(&None), Some(&dec!(450)));
}
