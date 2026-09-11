use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::time::{sleep, Duration};

use crate::agents::config::AgentPluginRegistry;
use crate::config::AppConfig;
use crate::database::queries;
use crate::database::DbPool;
use crate::errors::AppError;
use crate::llm::create_llm_client;
use crate::orchestrator::events::EventBus;
use crate::orchestrator::executor::TaskExecutor;
use crate::orchestrator::queue::TaskQueue;
use crate::tools::ToolRegistry;

pub struct OrchestratorEngine {
    pool: DbPool,
    config: Arc<Mutex<AppConfig>>,
    is_running: Arc<AtomicBool>,
    event_bus: Arc<EventBus>,
    queue: TaskQueue,
    tools: Arc<ToolRegistry>,
    agent_registry: Arc<AgentPluginRegistry>,
}

impl OrchestratorEngine {
    pub fn new(
        pool: DbPool,
        config: Arc<Mutex<AppConfig>>,
        event_bus: Arc<EventBus>,
        agent_registry: Arc<AgentPluginRegistry>,
    ) -> Self {
        Self {
            pool,
            config,
            is_running: Arc::new(AtomicBool::new(false)),
            event_bus,
            queue: TaskQueue::new(),
            tools: Arc::new(ToolRegistry::new()),
            agent_registry,
        }
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    pub fn start(&self) -> Result<(), AppError> {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return Ok(()); // Already running
        }

        let is_running = self.is_running.clone();
        let pool = self.pool.clone();
        let config = self.config.clone();
        let event_bus = self.event_bus.clone();
        let queue = self.queue.clone();
        let tools = self.tools.clone();
        let agent_registry = self.agent_registry.clone();

        tokio::spawn(async move {
            tracing::info!("Native Rust Orchestrator Engine started");

            while is_running.load(Ordering::SeqCst) {
                // 1. Poll database for pending tasks
                if let Ok(conn) = pool.get() {
                    if let Ok(pending_tasks) = queries::get_pending_tasks(&conn) {
                        for task in pending_tasks {
                            queue.push(task, "normal");
                        }
                    }
                }

                // 2. Process tasks from queue
                while let Some(task) = queue.pop() {
                    if !is_running.load(Ordering::SeqCst) {
                        break;
                    }

                    let cfg = config.lock().clone();
                    let (provider, api_key, model) = match cfg.mode {
                        crate::config::ExecutionMode::Local => (
                            "ollama".to_string(),
                            None,
                            cfg.models.local_base_model.clone(),
                        ),
                        crate::config::ExecutionMode::Cloud => (
                            cfg.models.cloud_provider.clone(),
                            match cfg.models.cloud_provider.to_lowercase().as_str() {
                                "anthropic" => cfg.models.anthropic_api_key.clone(),
                                "gemini" => cfg.models.gemini_api_key.clone(),
                                _ => cfg.models.openai_api_key.clone(),
                            },
                            cfg.models.cloud_model.clone(),
                        ),
                    };

                    let llm_client = match create_llm_client(
                        &provider,
                        api_key,
                        cfg.models.custom_endpoint.clone(),
                    ) {
                        Ok(client) => Arc::from(client),
                        Err(err) => {
                            tracing::error!("Failed to create LLM client: {}", err);
                            sleep(Duration::from_secs(5)).await;
                            continue;
                        }
                    };

                    if let Err(err) = TaskExecutor::execute_task(
                        task,
                        pool.clone(),
                        llm_client,
                        tools.clone(),
                        event_bus.clone(),
                        agent_registry.clone(),
                        model,
                    )
                    .await
                    {
                        tracing::error!("Task execution error: {}", err);
                    }
                }

                sleep(Duration::from_secs(3)).await;
            }

            tracing::info!("Native Rust Orchestrator Engine stopped");
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}
