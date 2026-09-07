use ::anyhow::Result;
use ::async_trait::async_trait;
use ::jobs::{Handler, Job};
use keiri_core::Core;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Serialize, Deserialize)]
pub struct BulkConfirmOcrJob {
    pub user_id: String,
    pub job_ids: Vec<String>,
}

impl Job for BulkConfirmOcrJob {
    const NAME: &'static str = "BULK_CONFIRM_OCR";
}

pub struct BulkConfirmOcrJobHandler;

#[async_trait]
impl Handler<BulkConfirmOcrJob, Arc<Core>> for BulkConfirmOcrJobHandler {
    async fn handle(&self, core: &Arc<Core>, job: BulkConfirmOcrJob) -> Result<()> {
        use futures::StreamExt;
        let stream = futures::stream::iter(job.job_ids).map(|job_id| {
            let core = core.clone();
            let user_id = job.user_id.clone();
            async move {
                let res = core
                    .ocr_manager
                    .confirm_job(core.clone(), &user_id, &job_id, None)
                    .await;
                (job_id, res)
            }
        });

        let mut results = stream.buffer_unordered(5);

        while let Some((job_id, result)) = results.next().await {
            match result {
                Ok(_) => tracing::info!("✅ Background bulk-confirm succeeded for job: {}", job_id),
                Err(e) => {
                    tracing::error!(
                        "❌ Background bulk-confirm failed for job {}: {}",
                        job_id,
                        e
                    );
                }
            }
        }

        Ok(())
    }
}
