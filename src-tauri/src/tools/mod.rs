pub mod browser;
pub mod filesystem;
pub mod mcp;
pub mod subagent_dispatcher;

use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::AppHandle;

use crate::agents::AgentPluginRegistry;
use crate::errors::AppError;
use crate::llm::ToolDefinition;
use crate::orchestrator::tiers::{EntitlementGuard, UserTier};

#[async_trait]
pub trait ToolExecutor: Send + Sync {
    fn name(&self) -> &str;
    fn can_handle(&self, tool_name: &str) -> bool;
    fn definitions(&self) -> Vec<ToolDefinition>;
    async fn execute(&self, tool_name: &str, params: Value) -> Result<Value, AppError>;
}

pub struct ToolRegistry {
    executors: Vec<Arc<dyn ToolExecutor>>,
    entitlement_guard: parking_lot::Mutex<EntitlementGuard>,
}

impl ToolRegistry {
    /// Create a full registry with all tools including the sub-agent dispatcher.
    pub fn new(agent_registry: Arc<AgentPluginRegistry>, app: Option<AppHandle>) -> Self {
        Self {
            executors: vec![
                Arc::new(filesystem::FilesystemTool::new()),
                Arc::new(browser::BrowserTool::new()),
                Arc::new(mcp::McpTool::new()),
                Arc::new(subagent_dispatcher::SubAgentDispatcherTool::new(agent_registry, app)),
            ],
            entitlement_guard: parking_lot::Mutex::new(EntitlementGuard::new(UserTier::Free)),
        }
    }

    /// Create a registry WITHOUT the sub-agent dispatcher.
    /// Used by child sub-agent runtimes to prevent infinite delegation recursion.
    pub fn new_without_subagents() -> Self {
        Self {
            executors: vec![
                Arc::new(filesystem::FilesystemTool::new()),
                Arc::new(browser::BrowserTool::new()),
                Arc::new(mcp::McpTool::new()),
            ],
            entitlement_guard: parking_lot::Mutex::new(EntitlementGuard::new(UserTier::Free)),
        }
    }

    /// Update the user tier at runtime (e.g., after login or subscription change).
    pub fn set_tier(&self, tier: UserTier) {
        self.entitlement_guard.lock().current_tier = tier;
    }

    pub fn get_tool_definitions(&self) -> Vec<ToolDefinition> {
        let mut defs = Vec::new();
        for executor in &self.executors {
            defs.extend(executor.definitions());
        }
        defs
    }

    pub async fn execute_tool(&self, tool_name: &str, params: Value) -> Result<Value, AppError> {
        // ── Tier Entitlement Gate ────────────────────────────────────────
        // Check the user's tier BEFORE dispatching to any executor.
        // If a free-tier user invokes a premium-only tool, halt immediately.
        {
            let guard = self.entitlement_guard.lock();
            guard.check_tool_access(tool_name)?;
        }

        for executor in &self.executors {
            if executor.can_handle(tool_name) {
                return executor.execute(tool_name, params).await;
            }
        }
        Err(AppError::ToolExecution {
            tool: tool_name.to_string(),
            message: format!("No registered executor for tool '{}'", tool_name),
        })
    }
}

