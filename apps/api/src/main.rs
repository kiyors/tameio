use axum::{
    Router,
    extract::FromRef,
    http::{HeaderValue, Method},
    routing::get,
};
pub use keiri_core::auth::AuthSession;
use keiri_core::better_auth::AxumIntegration;
use keiri_core::{Core, CoreConfig, sea_orm::DatabaseConnection};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};
use tower_http::LatencyUnit;
use tower_http::compression::CompressionLayer;
use tower_http::cors::CorsLayer;
use tower_http::trace::{DefaultOnResponse, TraceLayer};
use tracing::Level;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub mod background_tasks;
pub mod extractors;
pub mod middleware;
pub mod routes;

use crate::middleware::metrics::MetricsRegistry;
use crate::middleware::rate_limit::UserRateLimiter;

#[derive(Clone)]
pub struct AppState {
    pub core: Core,
    pub ocr_limiter: UserRateLimiter,
    pub metrics: MetricsRegistry,
}

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

impl FromRef<AppState> for Arc<DatabaseConnection> {
    fn from_ref(state: &AppState) -> Self {
        Arc::clone(&state.core.db)
    }
}

impl FromRef<AppState>
    for Arc<keiri_core::better_auth::BetterAuth<keiri_core::auth::adapter::PostgresAdapter>>
{
    fn from_ref(state: &AppState) -> Self {
        state.core.auth.clone()
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    dotenvy::dotenv().ok();

    let rust_log =
        std::env::var("RUST_LOG").unwrap_or_else(|_| "info,api=debug,better_auth=info".into());

    let filter_string = if rust_log.contains("sqlx=") {
        rust_log
    } else {
        format!("{},sqlx=error,sea_orm=warn,tower_http=debug", rust_log)
    };

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(filter_string))
        .with(
            tracing_subscriber::fmt::layer()
                .pretty()
                .with_target(false)
                .with_thread_ids(false)
                .with_file(false)
                .with_line_number(false),
        )
        .init();

    let (ocr_tx, _) = tokio::sync::broadcast::channel(100);

    let shutdown_token = tokio_util::sync::CancellationToken::new();
    let shutdown_token_clone = shutdown_token.clone();

    tokio::spawn(async move {
        use tokio::signal;
        let ctrl_c = async {
            signal::ctrl_c()
                .await
                .expect("failed to install Ctrl+C handler");
        };

        #[cfg(unix)]
        let terminate = async {
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("failed to install signal handler")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }

        tracing::info!("📥 Shutdown signal received, starting graceful shutdown...");
        shutdown_token_clone.cancel();
    });

    let core_config = CoreConfig {
        database_url: std::env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
        s3_endpoint: std::env::var("S3_ENDPOINT").expect("S3_ENDPOINT must be set"),
        s3_access_key_id: std::env::var("S3_ACCESS_KEY_ID").expect("S3_ACCESS_KEY_ID must be set"),
        s3_secret_access_key: std::env::var("S3_SECRET_ACCESS_KEY")
            .expect("S3_SECRET_ACCESS_KEY must be set"),
        s3_bucket_name: std::env::var("S3_BUCKET_NAME").expect("S3_BUCKET_NAME must be set"),
        google_api_key: std::env::var("GOOGLE_API_KEY").ok(),
        better_auth_secret: std::env::var("BETTER_AUTH_SECRET")
            .or_else(|_| std::env::var("BETTERAUTH_SECRET"))
            .expect("BETTER_AUTH_SECRET must be set"),
        better_auth_base_url: std::env::var("BETTER_AUTH_BASE_URL")
            .or_else(|_| std::env::var("BASE_URL"))
            .unwrap_or_else(|_| "http://localhost:7878".into()),
        shutdown_token: Some(shutdown_token.clone()),
    };

    let core = Core::init(core_config, ocr_tx).await?;

    // 🚀 Run automatic database migrations
    tracing::info!("🔄 Running automatic database migrations...");
    use migration::MigratorTrait;
    migration::Migrator::up(&*core.db, None)
        .await
        .map_err(|e| {
            tracing::error!("❌ Migration failed: {}", e);
            e
        })?;
    tracing::info!("✅ Database migrations complete.");

    // Start background workers from OCR manager
    core.ocr_manager.spawn_workers(Arc::new(core.clone()));

    // Initialize and start Generic Background Worker Pool
    let mut worker_pool = ::jobs::WorkerPool::new(core.db.clone(), Arc::new(core.clone()), 10)
        .with_cancellation_token(shutdown_token.clone());
    worker_pool.register_handler(background_tasks::BulkConfirmOcrJobHandler);
    let worker_pool = Arc::new(worker_pool);
    let worker_pool_clone = worker_pool.clone();
    tokio::spawn(async move {
        worker_pool_clone.run().await;
    });

    // OCR rate limit knobs — defaults match what was previously hard-coded.
    // Override at deploy-time via env when traffic patterns demand it.
    let ocr_rpm: u32 = std::env::var("OCR_RATE_LIMIT_RPM")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10);
    let ocr_burst: u32 = std::env::var("OCR_RATE_LIMIT_BURST")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(20);

    let state = AppState {
        core: core.clone(),
        ocr_limiter: UserRateLimiter::new(ocr_rpm, ocr_burst),
        metrics: MetricsRegistry::default(),
    };
    // Drop idle per-user rate limiter entries periodically so the map tracks
    // active users instead of growing monotonically for the life of the process.
    state.ocr_limiter.spawn_cleanup_task(shutdown_token.clone());

    let auth_router = core.auth.clone().axum_router();

    // Rate limiting config: ~1 request per second per IP, burst of 10
    let governor_conf = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(10)
            .finish()
            .ok_or("Failed to build governor configuration")?,
    );

    let api_router = Router::new()
        // /health (legacy shallow probe) and /health/live + /health/ready
        // (proper liveness + dependency-aware readiness).
        .route("/health", get(|| async { "OK" }))
        .nest("/health", routes::health::router())
        .nest("/transactions", routes::transactions::router())
        .nest("/budgets", routes::budgets::router())
        .nest("/p2p", routes::p2p::router())
        .nest("/groups", routes::groups::router())
        .nest("/contacts", routes::contacts::router())
        .nest("/wallets", routes::wallets::router())
        .nest("/users", routes::users::router())
        .nest("/categories", routes::categories::router())
        .nest("/subscriptions", routes::subscriptions::router())
        .nest("/reconciliation", routes::reconciliation::router())
        .nest("/upload", routes::uploads::router())
        .nest("/ocr", routes::ocr::router())
        .nest("/demo", routes::demo::router())
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::metrics::record_request,
        ))
        .layer(GovernorLayer::new(governor_conf));

    let allowed_origins = std::env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000,http://127.0.0.1:3000".to_string())
        .split(',')
        .map(|s| s.parse::<HeaderValue>())
        .collect::<Result<Vec<_>, _>>()?;

    let app = Router::new()
        .nest("/api/auth", auth_router.with_state(core.auth.clone()))
        .nest("/api", api_router)
        // /metrics is mounted AFTER the api_router so it is not measured by
        // the metrics middleware itself (which is attached inside api_router).
        .route(
            "/metrics",
            get(middleware::metrics::render_metrics).with_state(state.clone()),
        )
        .layer(CompressionLayer::new().gzip(true).br(true))
        .layer(
            TraceLayer::new_for_http().on_response(
                DefaultOnResponse::new()
                    .level(Level::INFO)
                    .latency_unit(LatencyUnit::Millis),
            ),
        )
        .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024))
        .layer(
            CorsLayer::new()
                .allow_origin(allowed_origins)
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::DELETE,
                    Method::PATCH,
                    Method::OPTIONS,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::ACCEPT,
                ])
                .allow_credentials(true),
        )
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 7878));
    tracing::info!("🚀 API starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async move {
        shutdown_token.cancelled().await;
        tracing::info!("👋 Axum server shutting down...");
    })
    .await?;

    Ok(())
}
