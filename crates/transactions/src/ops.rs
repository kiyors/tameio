use chrono::{DateTime, FixedOffset, Utc};
use db::AppError;
use db::entities;
use db::entities::enums::{
    P2pRequestStatus, TransactionDirection, TransactionSource, TransactionStatus, TxnPartyRole,
};
use db::{PaginatedTransactions, SplitDetail, TransactionWithDetail};
use rust_decimal::Decimal;
use sea_orm::prelude::DateTimeWithTimeZone;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait, JoinType,
    LoaderTrait, PaginatorTrait, QueryFilter, QueryOrder, QuerySelect, Set, TransactionError,
    TransactionTrait,
};
use std::sync::Arc;
use wallets::WalletsManager;

/// Creates a transaction, records any counterparty, and adjusts wallet balances atomically.
///
/// # Errors
/// Returns an error if the database transaction fails to commit, if inserting the
/// transaction, counterparty party, or wallet balance adjustment fails.
// Wide parameter list mirrors the domain DTO; refactor tracked separately.
#[allow(clippy::too_many_arguments)]
pub async fn create_transaction(
    db: &DatabaseConnection,
    wallets: Arc<WalletsManager>,
    user_id: &str,
    amount: Decimal,
    direction: TransactionDirection,
    date: DateTime<FixedOffset>,
    source: TransactionSource,
    purpose_tag: Option<String>,
    category_id: Option<String>,
    source_wallet_id: Option<String>,
    destination_wallet_id: Option<String>,
    contact_id: Option<String>,
    notes: Option<String>,
) -> Result<entities::transactions::Model, AppError> {
    let user_id = user_id.to_string();
    db.transaction::<_, entities::transactions::Model, AppError>(|txn_db| {
        let wallets = Arc::clone(&wallets);
        Box::pin(async move {
            let txn = entities::transactions::ActiveModel {
                id: Set(uuid::Uuid::now_v7().to_string()),
                user_id: Set(user_id),
                amount: Set(amount),
                direction: Set(direction),
                date: Set(date),
                source: Set(source),
                status: Set(TransactionStatus::Completed),
                purpose_tag: Set(purpose_tag),
                category_id: Set(category_id),
                group_id: Set(None),
                source_wallet_id: Set(source_wallet_id.clone()),
                destination_wallet_id: Set(destination_wallet_id.clone()),
                ledger_tab_id: Set(None),
                deleted_at: Set(None),
                notes: Set(notes),
            };

            let result = txn.insert(txn_db).await?;

            if let Some(c_id) = contact_id {
                let party = entities::txn_parties::ActiveModel {
                    id: Set(uuid::Uuid::now_v7().to_string()),
                    transaction_id: Set(result.id.clone()),
                    user_id: Set(None),
                    contact_id: Set(Some(c_id)),
                    role: Set(TxnPartyRole::Counterparty),
                };
                party.insert(txn_db).await?;
            }

            // Adjust wallet balances
            adjust_transaction_wallets(txn_db, wallets, None, Some(&result)).await?;

            Ok(result)
        })
    })
    .await
    .map_err(|e| match e {
        TransactionError::Connection(ce) => AppError::Db(ce),
        TransactionError::Transaction(te) => te,
    })
}

/// Lists a user's non-deleted transactions with related category, wallet, and contact details.
///
/// # Errors
/// Returns an error if any of the count, transaction, relation, contact, or wallet
/// database queries fail.
// Loads multiple related entities in parallel and stitches them per row; the
// logic reads more clearly as a single function than as several thin helpers.
#[allow(clippy::too_many_lines)]
pub async fn list_transactions(
    db: &DatabaseConnection,
    user_id: &str,
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<PaginatedTransactions, AppError> {
    let base_query = entities::transactions::Entity::find()
        .filter(entities::transactions::Column::UserId.eq(user_id))
        .filter(entities::transactions::Column::DeletedAt.is_null());

    let mut results_query = base_query
        .clone()
        .order_by_desc(entities::transactions::Column::Date)
        .column_as(entities::categories::Column::Name, "category_name")
        .join_rev(
            JoinType::LeftJoin,
            entities::categories::Entity::belongs_to(entities::transactions::Entity)
                .from(entities::categories::Column::Id)
                .to(entities::transactions::Column::CategoryId)
                .into(),
        );

    if let Some(l) = limit {
        results_query = results_query.limit(l);
    }
    if let Some(o) = offset {
        results_query = results_query.offset(o);
    }

    // 1. Parallelize Count and Main Query
    let (total_count, results) = tokio::try_join!(
        async move { base_query.count(db).await.map_err(AppError::from) },
        async move { results_query.all(db).await.map_err(AppError::from) },
    )?;

    if results.is_empty() {
        return Ok(PaginatedTransactions {
            items: Vec::new(),
            total_count,
        });
    }

    // 2. Prepare for parallel loading of relations
    let categories_fut = results.load_one(entities::categories::Entity, db);
    let parties_fut = results.load_many(
        entities::txn_parties::Entity::find()
            .filter(entities::txn_parties::Column::Role.eq("COUNTERPARTY")),
        db,
    );

    let (categories, parties) = tokio::try_join!(
        async move { categories_fut.await.map_err(AppError::from) },
        async move { parties_fut.await.map_err(AppError::from) },
    )?;

    let categories_map = categories
        .into_iter()
        .flatten()
        .map(|c| (c.id, c.name))
        .collect::<std::collections::HashMap<String, String>>();

    // Now we have parties, we can fetch contacts
    let contact_ids: std::collections::HashSet<String> = parties
        .iter()
        .flatten()
        .filter_map(|p| p.contact_id.as_ref())
        .cloned()
        .collect();

    // Load wallets (source and destination)
    let wallet_ids: std::collections::HashSet<String> = results
        .iter()
        .flat_map(|t| {
            [
                t.source_wallet_id.as_ref(),
                t.destination_wallet_id.as_ref(),
            ]
        })
        .flatten()
        .cloned()
        .collect();

    let (contacts_res, wallets_res) = tokio::try_join!(
        async move {
            if contact_ids.is_empty() {
                Ok(Vec::new())
            } else {
                entities::contacts::Entity::find()
                    .filter(entities::contacts::Column::Id.is_in(contact_ids))
                    .all(db)
                    .await
                    .map_err(AppError::from)
            }
        },
        async move {
            if wallet_ids.is_empty() {
                Ok(Vec::new())
            } else {
                entities::wallets::Entity::find()
                    .filter(entities::wallets::Column::Id.is_in(wallet_ids))
                    .all(db)
                    .await
                    .map_err(AppError::from)
            }
        }
    )?;

    let contacts_map: std::collections::HashMap<String, String> =
        contacts_res.into_iter().map(|c| (c.id, c.name)).collect();

    let wallets_map: std::collections::HashMap<String, String> =
        wallets_res.into_iter().map(|w| (w.id, w.name)).collect();

    let mut final_results = Vec::with_capacity(results.len());

    for (i, txn) in results.into_iter().enumerate() {
        let source_wallet_name = txn
            .source_wallet_id
            .as_ref()
            .and_then(|id| wallets_map.get(id))
            .cloned();
        let destination_wallet_name = txn
            .destination_wallet_id
            .as_ref()
            .and_then(|id| wallets_map.get(id))
            .cloned();
        let category_name = txn
            .category_id
            .as_ref()
            .and_then(|id| categories_map.get(id))
            .cloned();

        let contact = parties[i].first();
        let contact_id = contact.and_then(|p| p.contact_id.as_ref()).cloned();
        let contact_name = contact_id
            .as_ref()
            .and_then(|id| contacts_map.get(id))
            .cloned();

        final_results.push(TransactionWithDetail {
            transaction: txn,
            source_wallet_name,
            destination_wallet_name,
            contact_name,
            contact_id,
            category_name,
        });
    }

    Ok(PaginatedTransactions {
        items: final_results,
        total_count,
    })
}

/// Updates a transaction's mutable fields, syncs its counterparty, and rebalances wallets.
///
/// # Errors
/// Returns an error if the transaction is not found, if the caller does not own it,
/// or if any database read, edit-log insert, update, or wallet adjustment fails.
// Wide parameter list mirrors the domain DTO; refactor tracked separately.
#[allow(clippy::too_many_arguments)]
pub async fn update_transaction(
    db: &DatabaseConnection,
    wallets: Arc<WalletsManager>,
    user_id: &str,
    txn_id: &str,
    amount: Option<Decimal>,
    date: Option<DateTimeWithTimeZone>,
    purpose_tag: Option<String>,
    category_id: Option<String>,
    status: Option<TransactionStatus>,
    notes: Option<String>,
    source_wallet_id: Option<String>,
    destination_wallet_id: Option<String>,
    contact_id: Option<String>,
) -> Result<entities::transactions::Model, AppError> {
    let user_id = user_id.to_string();
    let txn_id = txn_id.to_string();
    db.transaction::<_, entities::transactions::Model, AppError>(|txn_db| {
        let wallets = Arc::clone(&wallets);
        Box::pin(async move {
            let txn_model = entities::transactions::Entity::find_by_id(txn_id)
                .one(txn_db)
                .await?
                .ok_or_else(|| AppError::not_found("Transaction not found"))?;

            if txn_model.user_id != user_id {
                return Err(AppError::unauthorized("Unauthorized"));
            }

            let old_amount = txn_model.amount;
            let mut txn: entities::transactions::ActiveModel = txn_model.clone().into();

            if let Some(amt) = amount {
                if amt != old_amount {
                    let edit = entities::transaction_edits::ActiveModel {
                        id: Set(uuid::Uuid::now_v7().to_string()),
                        transaction_id: Set(txn.id.as_ref().clone()),
                        old_amount: Set(old_amount),
                        new_amount: Set(amt),
                        edited_at: Set(Utc::now().into()),
                    };
                    edit.insert(txn_db).await?;
                }
                txn.amount = Set(amt);
            }
            if let Some(dt) = date {
                txn.date = Set(dt);
            }
            if let Some(tag) = purpose_tag {
                txn.purpose_tag = Set(Some(tag));
            }
            if let Some(c_id) = category_id {
                txn.category_id = Set(Some(c_id));
            }
            if let Some(s) = status {
                txn.status = Set(s);
            }
            if let Some(n) = notes {
                txn.notes = Set(Some(n));
            }
            if let Some(sw_id) = source_wallet_id.clone() {
                txn.source_wallet_id = Set(if sw_id.is_empty() { None } else { Some(sw_id) });
            }
            if let Some(dw_id) = destination_wallet_id.clone() {
                txn.destination_wallet_id = Set(if dw_id.is_empty() { None } else { Some(dw_id) });
            }

            let result = txn.update(txn_db).await?;

            if let Some(c_id) = contact_id {
                entities::txn_parties::Entity::delete_many()
                    .filter(entities::txn_parties::Column::TransactionId.eq(result.id.clone()))
                    .filter(entities::txn_parties::Column::Role.eq("COUNTERPARTY"))
                    .exec(txn_db)
                    .await?;

                if !c_id.is_empty() {
                    let party = entities::txn_parties::ActiveModel {
                        id: Set(uuid::Uuid::now_v7().to_string()),
                        transaction_id: Set(result.id.clone()),
                        user_id: Set(None),
                        contact_id: Set(Some(c_id)),
                        role: Set(TxnPartyRole::Counterparty),
                    };
                    party.insert(txn_db).await?;
                }
            }

            adjust_transaction_wallets(txn_db, wallets, Some(&txn_model), Some(&result)).await?;

            Ok(result)
        })
    })
    .await
    .map_err(|e| match e {
        TransactionError::Connection(ce) => AppError::Db(ce),
        TransactionError::Transaction(te) => te,
    })
}

/// Soft-deletes a transaction and reverses its effect on wallet balances.
///
/// # Errors
/// Returns an error if the transaction is not found, if the caller does not own it,
/// or if any database update or wallet adjustment fails.
pub async fn delete_transaction(
    db: &DatabaseConnection,
    wallets: Arc<WalletsManager>,
    user_id: &str,
    txn_id: &str,
) -> Result<u64, AppError> {
    let user_id = user_id.to_string();
    let txn_id = txn_id.to_string();
    db.transaction::<_, u64, AppError>(|txn_db| {
        let wallets = Arc::clone(&wallets);
        Box::pin(async move {
            let txn_model = entities::transactions::Entity::find_by_id(txn_id)
                .one(txn_db)
                .await?
                .ok_or_else(|| AppError::not_found("Transaction not found"))?;

            if txn_model.user_id != user_id {
                return Err(AppError::unauthorized("Unauthorized"));
            }

            let mut txn: entities::transactions::ActiveModel = txn_model.clone().into();
            txn.deleted_at = Set(Some(Utc::now().into()));
            let result_model = txn.update(txn_db).await?;

            // Adjust wallet balances
            adjust_transaction_wallets(txn_db, wallets, Some(&txn_model), Some(&result_model))
                .await?;

            Ok(1)
        })
    })
    .await
    .map_err(|e| match e {
        TransactionError::Connection(ce) => AppError::Db(ce),
        TransactionError::Transaction(te) => te,
    })
}

/// Creates pending P2P requests that split an existing transaction across recipients.
///
/// # Errors
/// Returns an error if the source transaction is not found, or if any P2P request
/// insert within the database transaction fails.
pub async fn split_transaction(
    db: &DatabaseConnection,
    sender_id: &str,
    txn_id: &str,
    splits: Vec<SplitDetail>,
) -> Result<Vec<entities::p2p_requests::Model>, AppError> {
    let sender_id = sender_id.to_string();
    let txn_id = txn_id.to_string();

    db.transaction::<_, Vec<entities::p2p_requests::Model>, AppError>(|txn_db| {
        Box::pin(async move {
            let txn = entities::transactions::Entity::find_by_id(txn_id)
                .one(txn_db)
                .await?
                .ok_or_else(|| AppError::not_found("Transaction not found"))?;

            if txn.user_id != sender_id {
                return Err(AppError::unauthorized("Unauthorized"));
            }

            let mut results = Vec::with_capacity(splits.len());
            for split in splits {
                let request = entities::p2p_requests::ActiveModel {
                    id: Set(uuid::Uuid::now_v7().to_string()),
                    sender_user_id: Set(sender_id.clone()),
                    receiver_email: Set(split.receiver_email),
                    transaction_data: Set(serde_json::json!({
                        "amount": split.amount,
                        "date": txn.date,
                        "purpose": format!("Split for {}", txn.purpose_tag.as_deref().unwrap_or("Expense"))
                    })),
                    status: Set(P2pRequestStatus::Pending),
                    linked_txn_id: Set(None),
                };
                let result = request.insert(txn_db).await?;
                results.push(result);
            }
            Ok(results)
        })
    })
    .await
    .map_err(|e| match e {
        TransactionError::Connection(ce) => AppError::Db(ce),
        TransactionError::Transaction(te) => te,
    })
}

/// Reverses the wallet effect of `old_txn` (if active) and applies the effect of
/// `new_txn` (if active), so balances stay consistent across create/update/delete.
///
/// # Errors
/// Returns an error if any of the underlying wallet balance adjustments fail.
pub async fn adjust_transaction_wallets<C>(
    db: &C,
    wallets: Arc<WalletsManager>,
    old_txn: Option<&entities::transactions::Model>,
    new_txn: Option<&entities::transactions::Model>,
) -> Result<(), AppError>
where
    C: ConnectionTrait,
{
    // 1. Reverse old effect IF it was active (not cancelled AND not deleted)
    if let Some(old) = old_txn {
        let old_is_active = old.status != TransactionStatus::Cancelled && old.deleted_at.is_none();
        if old_is_active {
            if let Some(sw_id) = &old.source_wallet_id {
                wallets.adjust_balance(db, sw_id, old.amount, true).await?;
            }
            if let Some(dw_id) = &old.destination_wallet_id {
                wallets.adjust_balance(db, dw_id, -old.amount, true).await?;
            }
        }
    }

    // 2. Apply new effect IF it is active (not cancelled AND not deleted)
    if let Some(new) = new_txn {
        let new_is_active = new.status != TransactionStatus::Cancelled && new.deleted_at.is_none();
        if new_is_active {
            if let Some(sw_id) = &new.source_wallet_id {
                wallets.adjust_balance(db, sw_id, -new.amount, true).await?;
            }
            if let Some(dw_id) = &new.destination_wallet_id {
                wallets.adjust_balance(db, dw_id, new.amount, true).await?;
            }
        }
    }

    Ok(())
}
