use super::*;
use ::db::entities::enums::{
    TransactionDirection, TransactionSource, TransactionStatus, TxnPartyRole, WalletType,
};
use migration::{Migrator, MigratorTrait};
use sea_orm::{Database, DatabaseConnection, EntityTrait, Set};

async fn setup_test_db() -> DatabaseConnection {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    Migrator::up(&db, None).await.unwrap();

    // Create system user
    let now = chrono::Utc::now().into();
    let system_user = entities::users::ActiveModel {
        id: Set("system".to_string()),
        email: Set("system@tameio.app".to_string()),
        name: Set("System".to_string()),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };
    entities::users::Entity::insert(system_user)
        .exec(&db)
        .await
        .unwrap();

    db
}

async fn create_test_user(db: &DatabaseConnection, id: &str) -> entities::users::Model {
    let now = chrono::Utc::now().into();
    let user = entities::users::ActiveModel {
        id: Set(id.to_string()),
        email: Set(format!("{id}@example.com")),
        name: Set(format!("User {id}")),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };
    entities::users::Entity::insert(user)
        .exec(db)
        .await
        .unwrap();
    entities::users::Entity::find_by_id(id.to_string())
        .one(db)
        .await
        .unwrap()
        .unwrap()
}

#[tokio::test]
async fn test_get_dashboard_summary_empty() {
    let db = setup_test_db().await;
    let user = create_test_user(&db, "user_1").await;

    let summary = summary::get_dashboard_summary(&db, &user.id).await.unwrap();

    assert_eq!(summary.total_balance, Decimal::ZERO);
    assert_eq!(summary.total_transactions, 0);
}

#[tokio::test]
async fn test_get_dashboard_summary_with_data() {
    let db = setup_test_db().await;
    let user = create_test_user(&db, "user_1").await;
    let now = chrono::Utc::now().into();

    // Create a wallet
    let wallet = entities::wallets::ActiveModel {
        id: Set("wallet_1".to_string()),
        user_id: Set(user.id.clone()),
        name: Set("Cash".to_string()),
        r#type: Set(WalletType::Cash),
        balance: Set(Decimal::from(1000)),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };
    entities::wallets::Entity::insert(wallet)
        .exec(&db)
        .await
        .unwrap();

    // Create a transaction
    let txn = entities::transactions::ActiveModel {
        id: Set("txn_1".to_string()),
        user_id: Set(user.id.clone()),
        amount: Set(Decimal::from(100)),
        direction: Set(TransactionDirection::Out),
        date: Set(now),
        source: Set(TransactionSource::Manual),
        status: Set(TransactionStatus::Completed),
        source_wallet_id: Set(Some("wallet_1".to_string())),
        ..Default::default()
    };
    entities::transactions::Entity::insert(txn)
        .exec(&db)
        .await
        .unwrap();

    let summary = summary::get_dashboard_summary(&db, &user.id).await.unwrap();

    assert_eq!(summary.total_balance, Decimal::from(1000));
    assert_eq!(summary.total_transactions, 1);
    assert_eq!(summary.monthly_spend, Decimal::from(100));
}

#[tokio::test]
async fn test_list_transactions_with_relations() {
    let db = setup_test_db().await;
    let user = create_test_user(&db, "user_1").await;
    let now = chrono::Utc::now().into();

    // 1. Create Category
    let category = entities::categories::ActiveModel {
        id: Set("cat_1".to_string()),
        name: Set("Food".to_string()),
        user_id: Set("system".to_string()),
        ..Default::default()
    };
    entities::categories::Entity::insert(category)
        .exec(&db)
        .await
        .unwrap();

    // 2. Create Wallet
    let wallet = entities::wallets::ActiveModel {
        id: Set("wallet_1".to_string()),
        user_id: Set(user.id.clone()),
        name: Set("Bank".to_string()),
        r#type: Set(WalletType::Bank),
        balance: Set(Decimal::from(5000)),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };
    entities::wallets::Entity::insert(wallet)
        .exec(&db)
        .await
        .unwrap();

    // 3. Create Contact
    let contact = entities::contacts::ActiveModel {
        id: Set("contact_1".to_string()),
        name: Set("Starbucks".to_string()),
        ..Default::default()
    };
    entities::contacts::Entity::insert(contact)
        .exec(&db)
        .await
        .unwrap();

    // 3b. Create Contact Link
    let link = entities::contact_links::ActiveModel {
        user_id: Set(user.id.clone()),
        contact_id: Set("contact_1".to_string()),
    };
    entities::contact_links::Entity::insert(link)
        .exec(&db)
        .await
        .unwrap();

    // 4. Create Transaction
    let txn = entities::transactions::ActiveModel {
        id: Set("txn_1".to_string()),
        user_id: Set(user.id.clone()),
        amount: Set(Decimal::from(15)),
        direction: Set(TransactionDirection::Out),
        date: Set(now),
        source: Set(TransactionSource::Manual),
        status: Set(TransactionStatus::Completed),
        category_id: Set(Some("cat_1".to_string())),
        source_wallet_id: Set(Some("wallet_1".to_string())),
        ..Default::default()
    };
    entities::transactions::Entity::insert(txn)
        .exec(&db)
        .await
        .unwrap();

    // 5. Create Txn Party
    let party = entities::txn_parties::ActiveModel {
        id: Set("party_1".to_string()),
        transaction_id: Set("txn_1".to_string()),
        contact_id: Set(Some("contact_1".to_string())),
        role: Set(TxnPartyRole::Counterparty),
        ..Default::default()
    };
    entities::txn_parties::Entity::insert(party)
        .exec(&db)
        .await
        .unwrap();

    // 6. Test list
    let list = ops::list_transactions(&db, &user.id, None, None)
        .await
        .unwrap();

    assert_eq!(list.items.len(), 1);
    let item = &list.items[0];
    assert_eq!(item.category_name, Some("Food".to_string()));
    assert_eq!(item.source_wallet_name, Some("Bank".to_string()));
    assert_eq!(item.contact_name, Some("Starbucks".to_string()));
}

#[tokio::test]
async fn test_split_transaction_performance() {
    let db = setup_test_db().await;
    let user = create_test_user(&db, "user_1").await;
    let now = chrono::Utc::now().into();

    let txn = entities::transactions::ActiveModel {
        id: Set("txn_1".to_string()),
        user_id: Set(user.id.clone()),
        amount: Set(Decimal::from(1000)),
        direction: Set(TransactionDirection::Out),
        date: Set(now),
        source: Set(TransactionSource::Manual),
        status: Set(TransactionStatus::Completed),
        ..Default::default()
    };
    entities::transactions::Entity::insert(txn)
        .exec(&db)
        .await
        .unwrap();

    let mut splits = Vec::new();
    for i in 0..1000 {
        splits.push(SplitDetail {
            receiver_email: format!("user{i}@example.com"),
            amount: Decimal::from(1),
        });
    }

    let start = std::time::Instant::now();
    let results = ops::split_transaction(&db, &user.id, "txn_1", splits)
        .await
        .unwrap();
    let duration = start.elapsed();

    assert_eq!(results.len(), 1000);
    println!("split_transaction 1000 splits took: {duration:?}");
}
