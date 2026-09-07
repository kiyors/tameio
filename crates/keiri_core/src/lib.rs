pub mod services;

pub use db::AppError;
pub use db::GPayExtraction;
pub use db::LineItem;
pub use db::OcrResult;
pub use db::OcrTransactionResponse;
pub use db::P2pRequestWithSender;
pub use db::ProcessedOcr;
pub use db::SplitDetail;
pub use db::TransactionWithDetail;

pub mod ocr {
    pub use crate::services::ocr::*;
    pub use ::ocr::*;
}

pub mod wallets {
    pub use ::wallets::*;
}

pub mod transactions {
    pub use ::transactions::*;
}

pub mod groups {
    pub use ::groups::*;
}

pub mod reconciliation {
    pub use ::reconciliation::*;
}

pub mod subscriptions {
    pub use ::subscriptions::*;
}

pub mod budgets {
    pub use ::budgets::*;
}

pub mod contacts {
    pub use ::contacts::*;
}

pub mod categories {
    pub use ::categories::*;
}

pub mod users {
    pub use ::users::*;
}

// Re-export common crates so API doesn't need to depend on them directly
pub use auth;
pub use better_auth;
pub use sea_orm;
pub use upload;

use ::budgets::BudgetsManager;
use ::categories::CategoriesManager;
use ::contacts::ContactsManager;
use ::groups::GroupsManager;
use ::ocr::{OcrManager, OcrProcessor, OcrService};
use ::reconciliation::ReconciliationManager;
use ::subscriptions::SubscriptionsManager;
use ::transactions::TransactionsManager;
use ::users::UsersManager;
use ::wallets::WalletsManager;
use auth::adapter::PostgresAdapter;
use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use std::sync::Arc;
use std::time::Duration;
use upload::UploadClient;

#[derive(Clone)]
pub struct Core {
    pub db: Arc<DatabaseConnection>,
    pub auth: Arc<better_auth::BetterAuth<PostgresAdapter>>,
    pub upload_client: UploadClient,
    pub ocr_manager: Arc<OcrManager>,
    pub wallets: Arc<WalletsManager>,
    pub transactions: Arc<TransactionsManager>,
    pub groups: Arc<GroupsManager>,
    pub reconciliation: Arc<ReconciliationManager>,
    pub subscriptions: Arc<SubscriptionsManager>,
    pub budgets: Arc<BudgetsManager>,
    pub contacts: Arc<ContactsManager>,
    pub categories: Arc<CategoriesManager>,
    pub users: Arc<UsersManager>,
    pub jobs: Arc<dyn ::jobs::JobQueue>,
}

impl OcrProcessor for Core {
    fn process_ocr<'a>(
        &'a self,
        db: &'a DatabaseConnection,
        user_id: &str,
        processed: db::ProcessedOcr,
    ) -> std::pin::Pin<
        Box<
            dyn std::future::Future<Output = Result<db::OcrTransactionResponse, AppError>>
                + Send
                + 'a,
        >,
    > {
        let user_id = user_id.to_string();
        let contacts = self.contacts.clone();
        let wallets = self.wallets.clone();
        Box::pin(async move {
            services::ocr::process_ocr(db, contacts, wallets, &user_id, processed).await
        })
    }

    fn enrich_ocr<'a>(
        &'a self,
        db: &'a DatabaseConnection,
        user_id: &str,
        processed: db::ProcessedOcr,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<db::ProcessedOcr, AppError>> + Send + 'a>,
    > {
        let user_id = user_id.to_string();
        let contacts = self.contacts.clone();
        let wallets = self.wallets.clone();
        Box::pin(async move {
            services::ocr::enrich_ocr(db, contacts, wallets, &user_id, processed).await
        })
    }
}

fn parse_env_u32(key: &str, default: u32) -> u32 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn parse_env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

pub struct CoreConfig {
    pub database_url: String,
    pub s3_endpoint: String,
    pub s3_access_key_id: String,
    pub s3_secret_access_key: String,
    pub s3_bucket_name: String,
    pub google_api_key: Option<String>,
    pub better_auth_secret: String,
    pub better_auth_base_url: String,
    pub shutdown_token: Option<tokio_util::sync::CancellationToken>,
}

impl Core {
    // Bootstrap wires DB, managers, OCR worker, etc.; splitting purely to satisfy
    // the line-count lint would obscure the linear startup sequence.
    #[allow(clippy::missing_errors_doc, clippy::too_many_lines)]
    pub async fn init(
        config: CoreConfig,
        ocr_tx: tokio::sync::broadcast::Sender<::ocr::OcrUpdate>,
    ) -> Result<Self, anyhow::Error> {
        let shutdown_token = config.shutdown_token.unwrap_or_default();
        // 1. Resilient Database Connection
        //
        // Pool sizing is tuned for short-lived API requests: a deeper pool with a
        // tight acquire timeout fails fast under spikes instead of letting clients
        // wait 10 s for a connection. A longer idle timeout avoids tearing down
        // connections between bursts of traffic.
        let mut opt = ConnectOptions::new(config.database_url);
        let max_connections = parse_env_u32("DB_MAX_CONNECTIONS", 100);
        let min_connections = parse_env_u32("DB_MIN_CONNECTIONS", 5);
        let acquire_timeout_secs = parse_env_u64("DB_ACQUIRE_TIMEOUT_SECS", 3);
        let idle_timeout_secs = parse_env_u64("DB_IDLE_TIMEOUT_SECS", 600);
        opt.max_connections(max_connections)
            .min_connections(min_connections)
            .connect_timeout(Duration::from_secs(10))
            .acquire_timeout(Duration::from_secs(acquire_timeout_secs))
            .idle_timeout(Duration::from_secs(idle_timeout_secs))
            .max_lifetime(Duration::from_mins(30))
            // Per-query logging is useful in dev but the formatting cost is
            // non-trivial under load. Release builds opt out entirely.
            .sqlx_logging(cfg!(debug_assertions));

        let mut retry_count = 0;
        let db = loop {
            match Database::connect(opt.clone()).await {
                Ok(conn) => break conn,
                Err(e) if retry_count < 3 => {
                    retry_count += 1;
                    tracing::warn!(
                        "Database connection failed, retrying ({}/3): {}",
                        retry_count,
                        e
                    );
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
                Err(e) => {
                    return Err(anyhow::anyhow!(
                        "Database connection failed after 3 retries: {e}"
                    ));
                }
            }
        };

        let db = Arc::new(db);

        // Initialize Auth
        let auth = auth::init_auth(
            Arc::clone(&db),
            config.better_auth_secret,
            config.better_auth_base_url,
        )
        .await
        .map_err(|e| anyhow::anyhow!("Auth init failed: {e}"))?;

        // Initialize OCR Service
        let ocr_service = Arc::new(
            OcrService::new(config.google_api_key)
                .await
                .map_err(|e| anyhow::anyhow!("OCR init failed: {e}"))?,
        );

        // S3/R2 Setup
        let mut endpoint = config.s3_endpoint;
        if let Some(pos) = endpoint.rfind(".com/") {
            endpoint.truncate(pos + 4);
        }

        let s3_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .endpoint_url(endpoint)
            .region(aws_config::Region::new("auto"))
            .credentials_provider(aws_sdk_s3::config::Credentials::new(
                config.s3_access_key_id,
                config.s3_secret_access_key,
                None,
                None,
                "static",
            ))
            .load()
            .await;

        let s3_client_config = aws_sdk_s3::config::Builder::from(&s3_config)
            .force_path_style(true)
            .build();

        let s3_client = aws_sdk_s3::Client::from_conf(s3_client_config);
        let upload_client = UploadClient::new(s3_client, config.s3_bucket_name);

        let ocr_manager = Arc::new(
            OcrManager::new(ocr_service, Arc::clone(&db), upload_client.clone(), ocr_tx)
                .with_cancellation_token(shutdown_token.clone()),
        );

        let wallets = Arc::new(WalletsManager::new(Arc::clone(&db)));
        let transactions = Arc::new(TransactionsManager::new(Arc::clone(&db), wallets.clone()));
        let groups = Arc::new(GroupsManager::new(
            Arc::clone(&db),
            wallets.clone(),
            transactions.clone(),
        ));
        let reconciliation = Arc::new(ReconciliationManager::new(Arc::clone(&db)));
        let subscriptions = Arc::new(SubscriptionsManager::new(Arc::clone(&db)));
        let budgets = Arc::new(BudgetsManager::new(Arc::clone(&db)));
        let contacts = Arc::new(ContactsManager::new(Arc::clone(&db)));
        let categories = Arc::new(CategoriesManager::new(Arc::clone(&db)));
        let users = Arc::new(UsersManager::new(Arc::clone(&db)));
        let jobs = Arc::new(::jobs::DbJobQueue::new(Arc::clone(&db)));

        let core = Self {
            db,
            auth,
            upload_client,
            ocr_manager,
            wallets,
            transactions,
            groups,
            reconciliation,
            subscriptions,
            budgets,
            contacts,
            categories,
            users,
            jobs,
        };

        // Ensure system categories exist
        if let Err(e) = core.categories.ensure_system_categories().await {
            tracing::error!("Failed to ensure system categories: {:?}", e);
        }

        Ok(core)
    }
}
