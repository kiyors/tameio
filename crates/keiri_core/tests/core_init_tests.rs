use keiri_core::{Core, CoreConfig};
use rstest::*;
use std::sync::Arc;
use tracing_test::traced_test;

// Fixture for a default, valid CoreConfig
#[fixture]
fn default_core_config() -> CoreConfig {
    CoreConfig {
        database_url: "sqlite::memory:".to_string(), // In-memory SQLite for testing
        s3_endpoint: "http://localhost:9000".to_string(),
        s3_access_key_id: "test_access_key".to_string(),
        s3_secret_access_key: "test_secret_key".to_string(),
        s3_bucket_name: "test_bucket".to_string(),
        google_api_key: Some("http://localhost:8090".to_string()),
        better_auth_secret: "test_secret_key_at_least_32_chars_long_12345".to_string(),
        better_auth_base_url: "http://localhost:3000".to_string(),
        shutdown_token: None,
    }
}

#[fixture]
fn broadcast_channel() -> tokio::sync::broadcast::Sender<::ocr::OcrUpdate> {
    let (tx, _) = tokio::sync::broadcast::channel(100);
    tx
}

#[rstest]
#[tokio::test]
#[traced_test]
#[allow(unused_variables)]
async fn test_core_init_happy_path(
    default_core_config: CoreConfig,
    broadcast_channel: tokio::sync::broadcast::Sender<::ocr::OcrUpdate>,
) {
    let core = Core::init(default_core_config, broadcast_channel).await;
    assert!(
        core.is_ok(),
        "Core::init should succeed on happy path, but got {:?}",
        core.err()
    );
    let core_instance = core.unwrap();

    assert!(
        Arc::strong_count(&core_instance.auth) > 0,
        "Auth service should be initialized"
    );

    // Assert upload_client initialization state without exposing internals
    assert!(
        Arc::strong_count(&core_instance.upload_client.optimizer) > 0,
        "Upload client optimizer should be initialized"
    );

    // Assert ocr_service initialization state without exposing internals
    assert!(
        Arc::strong_count(&core_instance.ocr_manager.service) > 0,
        "OCR service should be initialized"
    );

    assert!(
        Arc::strong_count(&core_instance.ocr_manager) > 0,
        "OCR manager should be initialized"
    );
}

#[rstest]
#[tokio::test]
#[traced_test]
async fn test_core_init_db_connection_failure(
    broadcast_channel: tokio::sync::broadcast::Sender<::ocr::OcrUpdate>,
) {
    let _ = env_logger::builder().is_test(true).try_init();

    let config = CoreConfig {
        database_url: "invalid_db_url".to_string(),
        s3_endpoint: "http://localhost:9000".to_string(),
        s3_access_key_id: "test_access_key".to_string(),
        s3_secret_access_key: "test_secret_key".to_string(),
        s3_bucket_name: "test_bucket".to_string(),
        google_api_key: Some("http://localhost:8090".to_string()),
        better_auth_secret: "test_secret_key_at_least_32_chars_long_12345".to_string(),
        better_auth_base_url: "http://localhost:3000".to_string(),
        shutdown_token: None,
    };

    let core = Core::init(config, broadcast_channel).await;
    assert!(
        core.is_err(),
        "Core::init should fail with invalid database URL"
    );

    let error_message = match core {
        Ok(_) => panic!("Core::init unexpectedly succeeded"),
        Err(e) => e.to_string(),
    };

    assert!(
        error_message.contains("Database connection failed")
            || error_message.contains("cannot be parsed"),
        "Error message should indicate database connection issue: {error_message}"
    );
}
