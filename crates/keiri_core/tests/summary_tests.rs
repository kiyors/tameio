mod common;

use chrono::{Datelike, TimeZone, Utc};
use common::{create_test_user, create_test_wallet, setup_test_core};
use db::entities::enums::{TransactionDirection, TransactionSource};
use rstest::*;
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;

#[rstest]
#[tokio::test]
async fn test_get_dashboard_summary() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;

    // Create wallets with 0 balance
    let w1 = create_test_wallet(&core, &user_id, Decimal::ZERO).await;
    let w2 = create_test_wallet(&core, &user_id, Decimal::ZERO).await;
    let _w3 = create_test_wallet(&core, &user_id, Decimal::from_i32(-50).unwrap()).await;

    // Create transactions for this month
    let now = Utc::now();
    let this_month = now.fixed_offset();

    core.transactions
        .create(
            &user_id,
            Decimal::from_i32(50).unwrap(),
            TransactionDirection::Out,
            this_month,
            TransactionSource::Manual,
            None,
            None,
            Some(w1.clone()),
            None,
            None,
            None,
        )
        .await
        .unwrap();

    core.transactions
        .create(
            &user_id,
            Decimal::from_i32(150).unwrap(),
            TransactionDirection::In,
            this_month,
            TransactionSource::Manual,
            None,
            None,
            None,
            Some(w2.clone()),
            None,
            None,
        )
        .await
        .unwrap();

    let summary = core
        .transactions
        .get_summary(&user_id)
        .await
        .expect("Failed to get summary");

    // Total balance: 0 (W1) + 0 (W2) - 50 (W3) - 50 (Txn1) + 150 (Txn2) = 50
    assert_eq!(summary.total_balance, Decimal::from_i32(50).unwrap());
    assert_eq!(summary.monthly_spend, Decimal::from_i32(50).unwrap());
    assert_eq!(summary.monthly_income, Decimal::from_i32(150).unwrap());
}

#[rstest]
#[tokio::test]
async fn test_summary_monthly_boundary() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let wallet_id = create_test_wallet(&core, &user_id, Decimal::from_i32(1000).unwrap()).await;

    let now = Utc::now();

    // Last day of last month
    let last_month_date = Utc
        .with_ymd_and_hms(
            if now.month() == 1 {
                now.year() - 1
            } else {
                now.year()
            },
            if now.month() == 1 {
                12
            } else {
                now.month() - 1
            },
            28, // Safe day
            23,
            59,
            59,
        )
        .unwrap()
        .fixed_offset();

    // First day of this month
    let this_month_date = Utc
        .with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0)
        .unwrap()
        .fixed_offset();

    // Last month transaction
    core.transactions
        .create(
            &user_id,
            Decimal::from_i32(100).unwrap(),
            TransactionDirection::Out,
            last_month_date,
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

    // This month transaction
    core.transactions
        .create(
            &user_id,
            Decimal::from_i32(200).unwrap(),
            TransactionDirection::Out,
            this_month_date,
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

    let summary = core.transactions.get_summary(&user_id).await.unwrap();

    // Should only include this month's spend
    assert_eq!(summary.monthly_spend, Decimal::from_i32(200).unwrap());
}
