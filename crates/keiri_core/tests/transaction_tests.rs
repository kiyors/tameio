mod common;

use chrono::{TimeZone, Utc};
use common::{create_test_user, create_test_wallet, setup_test_core};
use db::entities::enums::{TransactionDirection, TransactionSource};
use db::entities::transactions;
use rstest::*;
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use sea_orm::EntityTrait;

#[rstest]
#[tokio::test]
async fn test_create_transaction_expense() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let initial_balance = Decimal::from_i32(1000).unwrap();
    let wallet_id = create_test_wallet(&core, &user_id, initial_balance).await;

    let amount = Decimal::from_i32(100).unwrap();
    let date = Utc::now().fixed_offset();

    let txn = core
        .transactions
        .create(
            &user_id,
            amount,
            TransactionDirection::Out,
            date,
            TransactionSource::Manual,
            None,
            None,
            Some(wallet_id.clone()),
            None,
            None,
            None,
        )
        .await
        .expect("Failed to create transaction");

    assert_eq!(txn.amount, amount);
    assert_eq!(txn.direction, TransactionDirection::Out);

    // Verify wallet balance
    let wallet = core
        .wallets
        .get(&user_id, &wallet_id)
        .await
        .expect("Failed to get wallet");
    assert_eq!(wallet.balance, initial_balance - amount);
}

#[rstest]
#[tokio::test]
async fn test_create_transaction_income() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let initial_balance = Decimal::from_i32(1000).unwrap();
    let wallet_id = create_test_wallet(&core, &user_id, initial_balance).await;

    let amount = Decimal::from_i32(500).unwrap();
    let date = Utc::now().fixed_offset();

    let txn = core
        .transactions
        .create(
            &user_id,
            amount,
            TransactionDirection::In,
            date,
            TransactionSource::Manual,
            None,
            None,
            None,
            Some(wallet_id.clone()),
            None,
            None,
        )
        .await
        .expect("Failed to create transaction");

    assert_eq!(txn.amount, amount);
    assert_eq!(txn.direction, TransactionDirection::In);

    // Verify wallet balance
    let wallet = core
        .wallets
        .get(&user_id, &wallet_id)
        .await
        .expect("Failed to get wallet");
    assert_eq!(wallet.balance, initial_balance + amount);
}

#[rstest]
#[tokio::test]
async fn test_update_transaction_delta() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let initial_balance = Decimal::from_i32(1000).unwrap();
    let wallet_id = create_test_wallet(&core, &user_id, initial_balance).await;

    let old_amount = Decimal::from_i32(100).unwrap();
    let txn = core
        .transactions
        .create(
            &user_id,
            old_amount,
            TransactionDirection::Out,
            Utc::now().fixed_offset(),
            TransactionSource::Manual,
            None,
            None,
            Some(wallet_id.clone()),
            None,
            None,
            None,
        )
        .await
        .expect("Failed to create transaction");

    let new_amount = Decimal::from_i32(120).unwrap();
    core.transactions
        .update(
            &user_id,
            &txn.id,
            Some(new_amount),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .expect("Failed to update transaction");

    // Verify wallet balance: 1000 - 120 = 880
    let wallet = core
        .wallets
        .get(&user_id, &wallet_id)
        .await
        .expect("Failed to get wallet");
    assert_eq!(wallet.balance, initial_balance - new_amount);
}

#[rstest]
#[tokio::test]
async fn test_transaction_timezone_shifts() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let wallet_id = create_test_wallet(&core, &user_id, Decimal::ZERO).await;

    // IST is UTC+5:30
    let ist_offset = chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60).unwrap();
    let ist_date = ist_offset.with_ymd_and_hms(2024, 4, 20, 10, 0, 0).unwrap();

    let txn = core
        .transactions
        .create(
            &user_id,
            Decimal::from_i32(100).unwrap(),
            TransactionDirection::Out,
            ist_date,
            TransactionSource::Manual,
            None,
            None,
            Some(wallet_id),
            None,
            None,
            None,
        )
        .await
        .expect("Failed to create transaction");

    assert_eq!(txn.date.timestamp(), ist_date.timestamp());
}

#[rstest]
#[tokio::test]
async fn test_currency_precision_rounding() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let wallet_id = create_test_wallet(&core, &user_id, Decimal::ZERO).await;

    // Very precise amount
    let amount = Decimal::from_str_radix("1234.56789", 10).unwrap();

    let txn = core
        .transactions
        .create(
            &user_id,
            amount,
            TransactionDirection::In,
            Utc::now().fixed_offset(),
            TransactionSource::Manual,
            None,
            None,
            None,
            Some(wallet_id.clone()),
            None,
            None,
        )
        .await
        .expect("Failed to create transaction");

    assert_eq!(txn.amount, amount);

    let wallet = core
        .wallets
        .get(&user_id, &wallet_id)
        .await
        .expect("Failed to get wallet");
    assert_eq!(wallet.balance, amount);
}

#[rstest]
#[tokio::test]
async fn test_delete_transaction_soft_delete() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let initial_balance = Decimal::from_i32(1000).unwrap();
    let wallet_id = create_test_wallet(&core, &user_id, initial_balance).await;

    let amount = Decimal::from_i32(100).unwrap();
    let txn = core
        .transactions
        .create(
            &user_id,
            amount,
            TransactionDirection::Out,
            Utc::now().fixed_offset(),
            TransactionSource::Manual,
            None,
            None,
            Some(wallet_id.clone()),
            None,
            None,
            None,
        )
        .await
        .expect("Failed to create transaction");

    core.transactions
        .delete(&user_id, &txn.id)
        .await
        .expect("Failed to delete transaction");

    // Verify soft delete
    let db_txn = transactions::Entity::find_by_id(txn.id)
        .one(&*core.db)
        .await
        .unwrap()
        .unwrap();
    assert!(db_txn.deleted_at.is_some());

    // Verify balance reversal
    let wallet = core
        .wallets
        .get(&user_id, &wallet_id)
        .await
        .expect("Failed to get wallet");
    assert_eq!(wallet.balance, initial_balance);
}

#[rstest]
#[tokio::test]
async fn test_list_transactions_optimized() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let wallet_id = create_test_wallet(&core, &user_id, Decimal::from_i32(1000).unwrap()).await;

    // Seed 15 items
    for i in 0..15 {
        core.transactions
            .create(
                &user_id,
                Decimal::from_i32(10 + i).unwrap(),
                TransactionDirection::Out,
                Utc::now().fixed_offset(),
                TransactionSource::Manual,
                Some(format!("Txn {i}")),
                None,
                Some(wallet_id.clone()),
                None,
                None,
                None,
            )
            .await
            .unwrap();
    }

    // Fetch limit: 10, offset: 10 (should return 5 items)
    let result = core
        .transactions
        .list(&user_id, Some(10), Some(10))
        .await
        .expect("Failed to list transactions");

    assert_eq!(result.items.len(), 5);
    assert_eq!(result.total_count, 15);

    // Verify detail fields are populated
    for item in result.items {
        assert!(item.source_wallet_name.is_some());
        assert_eq!(item.source_wallet_name.unwrap(), "Test Wallet");
    }
}
