use ::contacts::ContactsManager;
use ::ocr::strategies::get_strategy;
use ::wallets::WalletsManager;
use db::entities;
use db::{AppError, OcrTransactionResponse, ProcessedOcr};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, TransactionTrait};
use std::sync::Arc;

#[allow(clippy::missing_errors_doc)]
pub async fn enrich_ocr(
    db: &DatabaseConnection,
    contacts_manager: Arc<ContactsManager>,
    wallets_manager: Arc<WalletsManager>,
    user_id: &str,
    processed: ProcessedOcr,
) -> Result<ProcessedOcr, AppError> {
    let strategy = get_strategy(&processed.doc_type);
    strategy
        .enrich(db, contacts_manager, wallets_manager, user_id, processed)
        .await
}

#[allow(clippy::missing_errors_doc)]
pub async fn process_ocr(
    db: &DatabaseConnection,
    contacts_manager: Arc<ContactsManager>,
    wallets_manager: Arc<WalletsManager>,
    user_id: &str,
    processed: ProcessedOcr,
) -> Result<OcrTransactionResponse, AppError> {
    // 3.2 Idempotency check
    if let Some(ref key) = processed.r2_key {
        let existing_source = entities::transaction_sources::Entity::find()
            .filter(entities::transaction_sources::Column::R2FileUrl.eq(Some(key.clone())))
            .one(db)
            .await?;

        if let Some(source) = existing_source {
            let txn = entities::transactions::Entity::find_by_id(source.transaction_id)
                .one(db)
                .await?
                .ok_or_else(|| {
                    AppError::Generic("Source exists but transaction not found".to_string())
                })?;

            return Ok(OcrTransactionResponse {
                transaction: txn,
                contact_created: false,
                batch_count: 1,
            });
        }
    }

    let user_id_owned = user_id.to_string();
    let contacts_clone = contacts_manager.clone();
    let wallets_clone = wallets_manager.clone();
    let doc_type = processed.doc_type.clone();

    db.transaction::<_, OcrTransactionResponse, AppError>(move |txn_db| {
        let user_id = user_id_owned;
        let processed = processed;
        let contacts = contacts_clone;
        let wallets = wallets_clone;
        let doc_type = doc_type;

        Box::pin(async move {
            let strategy = get_strategy(&doc_type);
            strategy
                .extract_and_save(txn_db, contacts, wallets, &user_id, processed)
                .await
        })
    })
    .await
    .map_err(|e| match e {
        sea_orm::TransactionError::Connection(ce) => AppError::Db(ce),
        sea_orm::TransactionError::Transaction(te) => te,
    })
}

pub use ::ocr::utils::parse_bank_date;
