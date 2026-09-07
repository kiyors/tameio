mod common;

use chrono::Utc;
use common::{create_test_user, create_test_wallet, setup_test_core};
use db::entities::enums::{TransactionDirection, TransactionSource};
use db::entities::transactions;
use rstest::*;
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

#[rstest]
#[tokio::test]
async fn test_wallet_ledger_parity() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let initial_balance = Decimal::from_i32(1000).unwrap();
    let wallet_id = create_test_wallet(&core, &user_id, initial_balance).await;

    // Create a few transactions
    let t1 = core
        .transactions
        .create(
            &user_id,
            Decimal::from_i32(100).unwrap(),
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
        .unwrap();

    let _t2 = core
        .transactions
        .create(
            &user_id,
            Decimal::from_i32(200).unwrap(),
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
        .unwrap();

    // Soft delete one
    core.transactions.delete(&user_id, &t1.id).await.unwrap();

    // Parity Check: sum of non-deleted transactions for this wallet
    let wallet = core.wallets.get(&user_id, &wallet_id).await.unwrap();
    assert_eq!(wallet.balance, Decimal::from_i32(1200).unwrap());

    // Manual double-entry check
    let txns = transactions::Entity::find()
        .filter(transactions::Column::DeletedAt.is_null())
        .all(&*core.db)
        .await
        .unwrap();

    let mut calculated_balance = initial_balance;
    for t in txns {
        if t.source_wallet_id.as_ref() == Some(&wallet_id) {
            calculated_balance -= t.amount;
        }
        if t.destination_wallet_id.as_ref() == Some(&wallet_id) {
            calculated_balance += t.amount;
        }
    }

    assert_eq!(
        wallet.balance, calculated_balance,
        "Wallet balance and ledger sum mismatch!"
    );
}
