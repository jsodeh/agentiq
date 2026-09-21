pub mod browser;
pub mod filesystem;
pub mod mcp;

use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::errors::AppError;
use crate::llm::ToolDefinition;

#[async_trait]
pub trait ToolExecutor: Send + Sync {
    fn name(&self) -> &str;
    fn can_handle(&self, tool_name: &str) -> bool;
    fn definitions(&self) -> Vec<ToolDefinition>;
    async fn execute(&self, tool_name: &str, params: Value) -> Result<Value, AppError>;
}

pub struct ToolRegistry {
    executors: Vec<Arc<dyn ToolExecutor>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            executors: vec![
                Arc::new(filesystem::FilesystemTool::new()),
                Arc::new(browser::BrowserTool::new()),
                Arc::new(mcp::McpTool::new()),
            ],
        }
    }

    pub fn get_tool_definitions(&self) -> Vec<ToolDefinition> {
        let mut defs = Vec::new();
        for executor in &self.executors {
            defs.extend(executor.definitions());
        }
        defs
    }

    pub async fn execute_tool(&self, tool_name: &str, params: Value) -> Result<Value, AppError> {
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

