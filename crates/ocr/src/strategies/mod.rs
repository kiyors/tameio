use ::contacts::ContactsManager;
use ::wallets::WalletsManager;
use async_trait::async_trait;
use db::{AppError, OcrTransactionResponse, ProcessedOcr};
use sea_orm::{DatabaseConnection, DatabaseTransaction};
use std::sync::Arc;

#[async_trait]
pub trait OcrExtractionStrategy: Send + Sync + std::any::Any {
    /// Enrich the OCR data before user review
    async fn enrich(
        &self,
        db: &DatabaseConnection,
        contacts: Arc<ContactsManager>,
        wallets: Arc<WalletsManager>,
        user_id: &str,
        processed: ProcessedOcr,
    ) -> Result<ProcessedOcr, AppError>;

    /// Extract and save transactions to the database after user confirmation
    async fn extract_and_save(
        &self,
        txn_db: &DatabaseTransaction,
        contacts: Arc<ContactsManager>,
        wallets: Arc<WalletsManager>,
        user_id: &str,
        processed: ProcessedOcr,
    ) -> Result<OcrTransactionResponse, AppError>;
}
pub mod bank;
pub mod generic;
pub mod upi;

pub fn get_strategy(doc_type: &str) -> Box<dyn OcrExtractionStrategy> {
    match doc_type {
        "BANK_STATEMENT" => Box::new(bank::BankStatementStrategy),
        "GPAY" => Box::new(upi::GPayStrategy),
        "GENERIC" => Box::new(generic::GenericStrategy),
        other => {
            tracing::warn!("Unknown OCR doc_type '{other}', falling back to GenericStrategy");
            Box::new(generic::GenericStrategy)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    #[rstest]
    #[case("BANK_STATEMENT", "bank::BankStatementStrategy")]
    #[case("GPAY", "upi::GPayStrategy")]
    #[case("GENERIC", "generic::GenericStrategy")]
    #[case("UNKNOWN_DOC_TYPE", "generic::GenericStrategy")]
    fn test_get_strategy(#[case] doc_type: &str, #[case] expected_type: &str) {
        let strategy = get_strategy(doc_type);
        let any = &*strategy as &dyn std::any::Any;

        match expected_type {
            "bank::BankStatementStrategy" => assert!(any.is::<bank::BankStatementStrategy>()),
            "upi::GPayStrategy" => assert!(any.is::<upi::GPayStrategy>()),
            "generic::GenericStrategy" => assert!(any.is::<generic::GenericStrategy>()),
            _ => panic!("Unknown expected type"),
        }
    }
}
