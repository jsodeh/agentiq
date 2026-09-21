use parking_lot::Mutex;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tracing::{error, info};

use crate::agents::AgentPluginRegistry;
use crate::config::AppConfig;
use crate::database::queries::Queries;
use crate::database::DbPool;
use crate::errors::AppError;
use crate::llm::{create_llm_client, ChatMessage, LlmRequest};
use crate::orchestrator::master::MasterOrchestrator;
use crate::tools::ToolRegistry;

pub struct ReActEngine;

impl ReActEngine {
    pub async fn execute_chat_turn(
        app: &AppHandle,
        pool: &DbPool,
        config: &Arc<Mutex<AppConfig>>,
        agent_registry: &Arc<AgentPluginRegistry>,
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
                role: m.role.clone(),
                content: m.content.clone(),
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
        let tool_registry = ToolRegistry::new();
        let tool_definitions = tool_registry.get_tool_definitions();
        let system_prompt = MasterOrchestrator::build_hydrated_system_prompt(pool, agent_registry, "default");

        let max_turns = 5;
        let mut final_content = String::new();

        // 4. ReAct Execution Loop
        for turn in 0..max_turns {
            info!("ReActEngine: Turn {}/{}", turn + 1, max_turns);

            let _ = app.emit("agent_thinking", serde_json::json!({
                "taskId": conversation_id,
                "reasoning": if turn == 0 { "Analyzing user request and available tools...".to_string() } else { format!("Processing step {}...", turn + 1) },
                "expectedOutcome": "Determining next action"
            }));

            let request = LlmRequest {
                system_prompt: Some(system_prompt.clone()),
                messages: chat_messages.clone(),
                model: model.clone(),
                max_tokens: Some(4096),
                temperature: Some(0.3),
                tools: if tool_definitions.is_empty() { None } else { Some(tool_definitions.clone()) },
            };

            let response = match llm_client.generate(&request).await {
                Ok(res) => res,
                Err(e) => {
                    error!("ReActEngine: LLM generate error on turn {}: {}", turn, e);
                    let _ = app.emit("action_failed", serde_json::json!({
                        "taskId": conversation_id,
                        "tool": "llm_client",
                        "error": e.to_string()
                    }));
                    return Err(e);
                }
            };

            // If the LLM returned tool calls, execute them
            if !response.tool_calls.is_empty() {
                info!("ReActEngine: Turn {} produced {} tool call(s)", turn + 1, response.tool_calls.len());

                for tool_call in &response.tool_calls {
                    info!("ReActEngine: Executing tool '{}' with args: {:?}", tool_call.name, tool_call.arguments);

                    let action_desc = format!("Executing tool '{}'", tool_call.name);
                    let _ = app.emit("action_started", serde_json::json!({
                        "taskId": conversation_id,
                        "tool": tool_call.name.clone(),
                        "params": tool_call.arguments.clone(),
                        "description": action_desc
                    }));

                    match tool_registry.execute_tool(&tool_call.name, tool_call.arguments.clone()).await {
                        Ok(res) => {
                            info!("ReActEngine: Tool '{}' succeeded", tool_call.name);
                            let _ = app.emit("action_completed", serde_json::json!({
                                "taskId": conversation_id,
                                "tool": tool_call.name.clone(),
                                "result": res.clone(),
                                "success": true
                            }));

                            let result_str = serde_json::to_string_pretty(&res).unwrap_or_else(|_| "Completed".to_string());
                            let tool_response_text = format!(
                                "TOOL_RESULT for '{}':\n{}\n\nPlease use this information to proceed to the next step or formulate your final response.",
                                tool_call.name, result_str
                            );

                            chat_messages.push(ChatMessage {
                                role: "user".to_string(),
                                content: tool_response_text,
                            });
                        }
                        Err(e) => {
                            error!("ReActEngine: Tool '{}' failed: {}", tool_call.name, e);
                            let _ = app.emit("action_failed", serde_json::json!({
                                "taskId": conversation_id,
                                "tool": tool_call.name.clone(),
                                "error": e.to_string()
                            }));

                            chat_messages.push(ChatMessage {
                                role: "user".to_string(),
                                content: format!("TOOL_ERROR for '{}': {}", tool_call.name, e),
                            });
                        }
                    }
                }
                // Continue to next turn to let LLM process the tool results
                continue;
            }

            // No tool calls produced — LLM has returned final text answer
            if !response.content.trim().is_empty() {
                final_content = response.content;
                break;
            }
        }

        if final_content.is_empty() {
            final_content = "Task processing completed.".to_string();
        }

        // Emit task completed telemetry
        let _ = app.emit("task_completed", serde_json::json!({
            "taskId": conversation_id,
            "result": { "output": final_content.clone() }
        }));

        // Store assistant response in database
        let conn = pool.get()?;
        let msg_id = Queries::add_message(&conn, conversation_id, "assistant", &final_content)?;

        Ok(crate::commands::chat::ChatResponse {
            message_id: msg_id,
            content: final_content,
        })
    }
}
