use parking_lot::Mutex;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tracing::{error, info, warn};

use crate::agents::AgentPluginRegistry;
use crate::config::AppConfig;
use crate::database::queries::Queries;
use crate::database::DbPool;
use crate::errors::AppError;
use crate::llm::{create_llm_client, ChatMessage, MessageRole};
use crate::orchestrator::master::MasterOrchestrator;
use crate::orchestrator::runtime::{AgentExecutionRuntime, ExecutionBudget};
use crate::orchestrator::suspension::SuspensionRegistry;
use crate::tools::ToolRegistry;

pub struct ReActEngine;

impl ReActEngine {
    pub async fn execute_chat_turn(
        app: &AppHandle,
        pool: &DbPool,
        config: &Arc<Mutex<AppConfig>>,
        agent_registry: &Arc<AgentPluginRegistry>,
        suspension_registry: &Arc<SuspensionRegistry>,
        conversation_id: i64,
        message: &str,
    ) -> Result<crate::commands::chat::ChatResponse, AppError> {
        info!("ReActEngine: Processing message for conversation {}", conversation_id);

        // 1. Ingest message into database
        let conn = pool.get()?;
        Queries::add_message(&conn, conversation_id, "user", message)?;
        let db_messages = Queries::get_conversation_messages(&conn, conversation_id)?;
        drop(conn);

        // Build history window (last 12 messages)
        let history_slice = if db_messages.len() > 12 {
            &db_messages[db_messages.len() - 12..]
        } else {
            &db_messages[..]
        };

        let mut chat_messages: Vec<ChatMessage> = history_slice
            .iter()
            .map(|m| ChatMessage {
                role: match m.role.as_str() {
                    "assistant" => MessageRole::Assistant,
                    "tool" => MessageRole::Tool,
                    "system" => MessageRole::System,
                    _ => MessageRole::User,
                },
                content: Some(m.content.clone()),
                tool_calls: None,
                tool_responses: None,
            })
            .collect();

        // 2. Build LLM Client
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

        let llm_client = create_llm_client(&provider, api_key, cfg.models.custom_endpoint.clone())?;

        // 3. Prepare Tools and System Prompt
        let tool_registry = Arc::new(ToolRegistry::new(agent_registry.clone()));
        let tool_definitions = tool_registry.get_tool_definitions();
        let system_prompt = MasterOrchestrator::build_hydrated_system_prompt(pool, agent_registry, "default");

        // 4. Create a dynamic execution budget for interactive chat
        let mut budget = ExecutionBudget::for_chat();

        // 5. Delegate to the Unified Runtime
        let result = AgentExecutionRuntime::run_loop(
            Some(app),
            conversation_id,
            llm_client.as_ref(),
            &system_prompt,
            &mut chat_messages,
            &tool_registry,
            &tool_definitions,
            &model,
            &mut budget,
            Some(suspension_registry),
            None, // No parent task ID for primary chat
            Some(pool),
        )
        .await?;


        info!(
            "ReActEngine: Completed for conversation {} in {} turns ({} tokens)",
            conversation_id, result.total_turns, result.total_tokens
        );

        // Store assistant response in database
        let conn = pool.get()?;
        let msg_id = Queries::add_message(&conn, conversation_id, "assistant", &result.final_content)?;

        Ok(crate::commands::chat::ChatResponse {
            message_id: msg_id,
            content: result.final_content,
        })
    }
}
