mod common;

use chrono::{Duration, Utc};
use common::{create_test_user, create_test_wallet, setup_test_core};
use db::entities::enums::{SubscriptionCycle, TransactionDirection, TransactionSource};
use rstest::*;
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;

#[rstest]
#[tokio::test]
async fn test_detect_subscriptions_monthly() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let wallet_id = create_test_wallet(&core, &user_id, Decimal::from_i32(1000).unwrap()).await;

    let now = Utc::now();

    // Create 3 transactions exactly 30 days apart
    for i in 0..3 {
        let date = (now - Duration::days(i * 30)).fixed_offset();
        core.transactions
            .create(
                &user_id,
                Decimal::from_i32(199).unwrap(),
                TransactionDirection::Out,
                date,
                TransactionSource::Manual,
                Some("Netflix".to_string()),
                None,
                Some(wallet_id.clone()),
                None,
                None,
                None,
            )
            .await
            .unwrap();
    }

    let subs = core
        .subscriptions
        .detect(&user_id)
        .await
        .expect("Failed to detect subscriptions");

    assert!(!subs.is_empty(), "Should detect at least one subscription");
    let netflix = subs
        .iter()
        .find(|s| s.name == "Netflix")
        .expect("Netflix subscription not found");
    assert_eq!(netflix.amount, Decimal::from_i32(199).unwrap());
    assert_eq!(netflix.cycle, SubscriptionCycle::Monthly);
}

#[rstest]
#[tokio::test]
async fn test_detect_subscriptions_fuzzy_date() {
    let core = setup_test_core().await;
    let user_id = create_test_user(&core).await;
    let wallet_id = create_test_wallet(&core, &user_id, Decimal::from_i32(1000).unwrap()).await;

    let now = Utc::now();

    // Transactions roughly 1 month apart (28, 32 days)
    let dates = vec![
        now,
        now - Duration::days(28),
        now - Duration::days(60), // 60 - 28 = 32 days
    ];

    for date in dates {
        core.transactions
            .create(
                &user_id,
                Decimal::from_i32(299).unwrap(),
                TransactionDirection::Out,
                date.fixed_offset(),
                TransactionSource::Manual,
                Some("Spotify".to_string()),
                None,
                Some(wallet_id.clone()),
                None,
                None,
                None,
            )
            .await
            .unwrap();
    }

    let subs = core.subscriptions.detect(&user_id).await.unwrap();
    assert!(!subs.is_empty(), "Should detect fuzzy date subscription");
    let spotify = subs
        .iter()
        .find(|s| s.name == "Spotify")
        .expect("Spotify subscription not found");
    assert_eq!(spotify.cycle, SubscriptionCycle::Monthly);
}
