use parking_lot::Mutex;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tracing::{error, info};
use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::database::queries::Queries;
use crate::database::DbPool;
use crate::errors::AppError;
use crate::llm::{create_llm_client, ChatMessage, LlmRequest};

use crate::orchestrator::master::MasterOrchestrator;
use crate::orchestrator::parser::ResponseParser;
use crate::tools::ToolRegistry;
use crate::agents::AgentPluginRegistry;

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message_id: i64,
    pub content: String,
}

#[tauri::command]
pub async fn send_chat_message(
    app: AppHandle,
    pool: State<'_, DbPool>,
    config: State<'_, Arc<Mutex<AppConfig>>>,
    agent_registry: State<'_, Arc<AgentPluginRegistry>>,
    conversation_id: i64,
    message: String,
) -> Result<ChatResponse, AppError> {
    info!("Fast direct chat message for conversation {}", conversation_id);

    let conn = pool.get()?;

    // 1. Save user message to database
    Queries::add_message(&conn, conversation_id, "user", &message)?;

    // 2. Fetch conversation history
    let db_messages = Queries::get_conversation_messages(&conn, conversation_id)?;
    drop(conn);

    // Limit to last 10 messages for prompt context window
    let history_slice = if db_messages.len() > 10 {
        &db_messages[db_messages.len() - 10..]
    } else {
        &db_messages[..]
    };

    let mut chat_messages: Vec<ChatMessage> = history_slice
        .iter()
        .map(|m| ChatMessage {
            role: m.role.clone(),
            content: m.content.clone(),
        })
        .collect();

    // 3. Obtain LLM client configured in AppConfig
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

    let llm_client = create_llm_client(
        &provider,
        api_key,
        cfg.models.custom_endpoint.clone(),
    )?;

    // Build Master Orchestrator hydrated prompt with knowledge base, memory, tools, and sub-agents
    let system_prompt = MasterOrchestrator::build_hydrated_system_prompt(&pool, &agent_registry, "default");

    let request = LlmRequest {
        system_prompt: Some(system_prompt.clone()),
        messages: chat_messages.clone(),
        model: model.clone(),
        max_tokens: Some(4096),
        temperature: Some(0.7),
        tools: None,
    };

    // 4. Generate initial LLM response
    let initial_response = llm_client.generate(&request).await.map_err(|e| {
        error!("Direct chat LLM error: {}", e);
        e
    })?;

    // 5. Check if the LLM output an Action Plan with tool actions
    info!("Initial LLM response len={}, starts_with={:?}", initial_response.content.len(), &initial_response.content.chars().take(30).collect::<String>());
    let final_content = if let Ok(plan) = ResponseParser::parse(&initial_response.content) {
        if !plan.actions.is_empty() {
            info!("Action plan detected in chat turn with {} actions. Executing tools...", plan.actions.len());

            // Emit thinking event to UI
            let _ = app.emit("agent_thinking", serde_json::json!({
                "taskId": conversation_id,
                "reasoning": plan.reasoning,
                "expectedOutcome": plan.expected_outcome
            }));
            
            let tools = ToolRegistry::new();
            let mut tool_results = Vec::new();

            for action in &plan.actions {
                info!("Executing chat tool: {}", action.tool);

                // Emit action started event to UI
                let _ = app.emit("action_started", serde_json::json!({
                    "taskId": conversation_id,
                    "tool": action.tool,
                    "params": action.params,
                    "description": action.description
                }));

                match tools.execute_tool(&action.tool, action.params.clone()).await {
                    Ok(res) => {
                        let _ = app.emit("action_completed", serde_json::json!({
                            "taskId": conversation_id,
                            "tool": action.tool,
                            "result": res
                        }));

                        tool_results.push(serde_json::json!({
                            "tool": action.tool,
                            "success": true,
                            "result": res
                        }));
                    }
                    Err(err) => {
                        let err_str = err.to_string();
                        let _ = app.emit("action_failed", serde_json::json!({
                            "taskId": conversation_id,
                            "tool": action.tool,
                            "error": err_str
                        }));

                        tool_results.push(serde_json::json!({
                            "tool": action.tool,
                            "success": false,
                            "error": err_str
                        }));
                    }
                }
            }

            // Append assistant plan and tool execution results into context
            chat_messages.push(ChatMessage {
                role: "assistant".to_string(),
                content: initial_response.content.clone(),
            });

            let tool_results_summary = serde_json::to_string_pretty(&tool_results)
                .unwrap_or_else(|_| "Tool execution complete".to_string());

            chat_messages.push(ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "SYSTEM TOOL EXECUTION RESULTS:\n{}\n\nSynthesize the above tool results and answer the original user request in clean, helpful markdown.",
                    tool_results_summary
                ),
            });

            let second_request = LlmRequest {
                system_prompt: Some(system_prompt),
                messages: chat_messages,
                model,
                max_tokens: Some(4096),
                temperature: Some(0.7),
                tools: None,
            };

            let synthesized = match llm_client.generate(&second_request).await {
                Ok(second_response) => second_response.content,
                Err(e) => {
                    error!("Synthesis turn LLM error: {}, falling back to tool output summary", e);
                    format!("Tool execution complete:\n```json\n{}\n```", tool_results_summary)
                }
            };

            let _ = app.emit("task_completed", serde_json::json!({
                "taskId": conversation_id,
                "result": { "output": synthesized.clone() }
            }));

            synthesized
        } else {
            initial_response.content
        }
    } else {
        initial_response.content
    };

    // 6. Save assistant response to DB
    let conn = pool.get()?;
    let assistant_msg_id = Queries::add_message(&conn, conversation_id, "assistant", &final_content)?;

    Ok(ChatResponse {
        message_id: assistant_msg_id,
        content: final_content,
    })
}
