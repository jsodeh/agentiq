use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::{error, info};

use super::ToolExecutor;
use crate::agents::AgentPluginRegistry;
use crate::errors::AppError;
use crate::llm::{create_llm_client, ChatMessage, MessageRole, ToolDefinition};
use crate::orchestrator::runtime::{AgentExecutionRuntime, ExecutionBudget};
use crate::tools::ToolRegistry;

// ────────────────────────────────────────────────────────────────────────────
// SubAgentDispatcherTool
//
// Exposes specialized sub-agents as first-class tools in the ToolRegistry.
// When the primary agent calls `delegate_to_subagent`, a child runtime
// spins up with an isolated context, runs to completion, and returns only
// a concise summary — never leaching raw intermediate steps into the
// parent's conversation history.
// ────────────────────────────────────────────────────────────────────────────

pub struct SubAgentDispatcherTool {
    agent_registry: Arc<AgentPluginRegistry>,
}

impl SubAgentDispatcherTool {
    pub fn new(agent_registry: Arc<AgentPluginRegistry>) -> Self {
        Self { agent_registry }
    }
}

#[async_trait]
impl ToolExecutor for SubAgentDispatcherTool {
    fn name(&self) -> &str {
        "subagent_dispatcher"
    }

    fn can_handle(&self, tool_name: &str) -> bool {
        tool_name == "delegate_to_subagent"
    }

    fn definitions(&self) -> Vec<ToolDefinition> {
        // Build the list of available sub-agent IDs dynamically
        let available_agents: Vec<String> = self
            .agent_registry
            .all()
            .iter()
            .map(|p| format!("{} ({})", p.id, p.name))
            .collect();

        let agents_description = if available_agents.is_empty() {
            "No specialized sub-agents are currently registered.".to_string()
        } else {
            format!(
                "Available sub-agents: {}",
                available_agents.join(", ")
            )
        };

        vec![ToolDefinition {
            name: "delegate_to_subagent".to_string(),
            description: format!(
                "Delegate a specific sub-task to a specialized sub-agent. \
                 The sub-agent runs in an isolated context and returns only a \
                 concise summary of its work. Use this when the task requires \
                 specialized domain expertise. {}",
                agents_description
            ),
            parameters: json!({
                "type": "object",
                "properties": {
                    "subagent_id": {
                        "type": "string",
                        "description": "The unique identifier of the sub-agent to delegate to (e.g., 'coder', 'market-research-analyst', 'cold-outreach')."
                    },
                    "task_description": {
                        "type": "string",
                        "description": "A clear, detailed description of the sub-task to delegate. Be specific about what output you expect."
                    }
                },
                "required": ["subagent_id", "task_description"]
            }),
        }]
    }

    async fn execute(&self, _tool_name: &str, params: Value) -> Result<Value, AppError> {
        let subagent_id = params["subagent_id"]
            .as_str()
            .ok_or_else(|| AppError::ToolExecution {
                tool: "delegate_to_subagent".to_string(),
                message: "Missing required parameter 'subagent_id'".to_string(),
            })?;

        let task_description = params["task_description"]
            .as_str()
            .ok_or_else(|| AppError::ToolExecution {
                tool: "delegate_to_subagent".to_string(),
                message: "Missing required parameter 'task_description'".to_string(),
            })?;

        info!(
            "SubAgentDispatcher: Delegating to '{}' with task: {}",
            subagent_id,
            &task_description[..task_description.len().min(100)]
        );

        // 1. Look up the sub-agent profile
        let plugin = self.agent_registry.get(subagent_id).ok_or_else(|| {
            AppError::ToolExecution {
                tool: "delegate_to_subagent".to_string(),
                message: format!(
                    "Sub-agent '{}' not found in registry. Available: {:?}",
                    subagent_id,
                    self.agent_registry
                        .all()
                        .iter()
                        .map(|p| p.id.as_str())
                        .collect::<Vec<_>>()
                ),
            }
        })?;

        // 2. Build the child system prompt from the sub-agent's persona
        let child_system_prompt = format!(
            "## Sub-Agent: {} ({})\n\n{}\n\n{}\n\n\
             RESPONSE INSTRUCTIONS:\n\
             You are running as an isolated sub-agent. Complete the assigned task thoroughly \
             and return a clear, structured markdown summary of your findings and results. \
             Be concise but comprehensive.",
            plugin.name, plugin.id, plugin.description, plugin.system_prompt
        );

        // 3. Create an isolated chat history for the child runtime
        let mut child_messages: Vec<ChatMessage> = vec![ChatMessage {
            role: MessageRole::User,
            content: Some(task_description.to_string()),
            tool_calls: None,
            tool_responses: None,
        }];

        // 4. Create an LLM client for the child
        // Use the sub-agent's preferred model if specified, otherwise use the
        // default from the environment. For simplicity, we use the same provider.
        let api_key = std::env::var("GEMINI_API_KEY")
            .ok()
            .or_else(|| std::env::var("OPENAI_API_KEY").ok())
            .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok());

        let provider = if std::env::var("GEMINI_API_KEY").is_ok() {
            "gemini"
        } else if std::env::var("OPENAI_API_KEY").is_ok() {
            "openai"
        } else if std::env::var("ANTHROPIC_API_KEY").is_ok() {
            "anthropic"
        } else {
            "ollama"
        };

        let model = plugin
            .default_model
            .clone()
            .unwrap_or_else(|| "gemini-2.5-flash".to_string());

        let llm_client = create_llm_client(provider, api_key, None)?;

        // 5. Create a child ToolRegistry (without sub-agent dispatching to prevent recursion)
        let child_tools = Arc::new(ToolRegistry::new_without_subagents());
        let child_tool_defs = child_tools.get_tool_definitions();

        // 6. Create a scoped budget for the sub-agent
        let mut child_budget = ExecutionBudget::for_subagent();

        // 7. Run the child runtime to completion
        let result = AgentExecutionRuntime::run_loop(
            None, // Headless — no Tauri events for child runtimes
            0,    // No task_id for sub-agent runs
            llm_client.as_ref(),
            &child_system_prompt,
            &mut child_messages,
            &child_tools,
            &child_tool_defs,
            &model,
            &mut child_budget,
            None, // No HITL approvals in child runtimes
        )
        .await;

        match result {
            Ok(runtime_result) => {
                info!(
                    "SubAgentDispatcher: '{}' completed in {} turns ({} tokens)",
                    subagent_id, runtime_result.total_turns, runtime_result.total_tokens
                );

                Ok(json!({
                    "subagent_id": subagent_id,
                    "subagent_name": plugin.name,
                    "status": "completed",
                    "summary": runtime_result.final_content,
                    "turns_used": runtime_result.total_turns,
                    "tokens_used": runtime_result.total_tokens
                }))
            }
            Err(e) => {
                error!(
                    "SubAgentDispatcher: '{}' failed: {}",
                    subagent_id, e
                );

                Ok(json!({
                    "subagent_id": subagent_id,
                    "subagent_name": plugin.name,
                    "status": "failed",
                    "error": e.to_string()
                }))
            }
        }
    }
}
