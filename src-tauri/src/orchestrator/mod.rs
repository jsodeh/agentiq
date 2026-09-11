pub mod engine;
pub mod escalation;
pub mod events;
pub mod executor;
pub mod parser;
pub mod queue;

use parking_lot::Mutex;
use std::sync::Arc;

use crate::agents::config::AgentPluginRegistry;
use crate::config::AppConfig;
use crate::database::DbPool;
use crate::errors::AppError;
use engine::OrchestratorEngine;
use events::EventBus;

pub struct NativeOrchestratorState {
    pub engine: Arc<OrchestratorEngine>,
    pub event_bus: Arc<EventBus>,
}

impl NativeOrchestratorState {
    pub fn new(
        pool: DbPool,
        config: Arc<Mutex<AppConfig>>,
        agent_registry: Arc<AgentPluginRegistry>,
    ) -> Self {
        let event_bus = Arc::new(EventBus::new(1000));
        let engine = Arc::new(OrchestratorEngine::new(
            pool,
            config,
            event_bus.clone(),
            agent_registry,
        ));

        Self { engine, event_bus }
    }

    pub fn start(&self) -> Result<(), AppError> {
        self.engine.start()
    }

    pub fn stop(&self) {
        self.engine.stop();
    }

    pub fn is_running(&self) -> bool {
        self.engine.is_running()
    }
}
