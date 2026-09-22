use parking_lot::Mutex;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tracing::{error, info, warn};

use crate::agents::AgentPluginRegistry;
use crate::config::AppConfig;
use crate::database::queries::Queries;
use crate::database::DbPool;
use crate::errors::AppError;
use crate::llm::{create_llm_client, ChatMessage, LlmRequest, MessageRole, NativeToolResponse};
use crate::orchestrator::context::ContextGuard;
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
        let tool_registry = Arc::new(ToolRegistry::new());
        let tool_definitions = tool_registry.get_tool_definitions();
        let system_prompt = MasterOrchestrator::build_hydrated_system_prompt(pool, agent_registry, "default");

        let max_turns = 5;
        let mut final_content = String::new();
        let mut executed_any_tools = false;

        // 4. ReAct Execution Loop
        for turn in 0..max_turns {
            info!("ReActEngine: Turn {}/{}", turn + 1, max_turns);

            let is_final_turn = turn == max_turns - 1;

            if turn == max_turns - 2 {
                let _ = app.emit("action_limit_warning", serde_json::json!({
                    "taskId": conversation_id,
                    "message": "Approaching action cap. Wrapping up execution..."
                }));
            }

            let _ = app.emit("agent_thinking", serde_json::json!({
                "taskId": conversation_id,
                "reasoning": if turn == 0 { "Analyzing user request and available tools...".to_string() } else { format!("Processing step {}...", turn + 1) },
                "expectedOutcome": "Determining next action"
            }));

            let turn_system_prompt = if is_final_turn {
                format!(
                    "{}\n\nALERT: This is your absolute final available execution turn. You are blocked from calling further tools. Synthesize all gathered facts into a complete answer.",
                    system_prompt
                )
            } else {
                system_prompt.clone()
            };

            let request = LlmRequest {
                system_prompt: Some(turn_system_prompt),
                messages: chat_messages.clone(),
                model: model.clone(),
                max_tokens: Some(4096),
                temperature: Some(0.3),
                tools: if is_final_turn || tool_definitions.is_empty() { None } else { Some(tool_definitions.clone()) },
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

            // If LLM returned tool calls and we're not on final turn, run them in parallel
            if !response.tool_calls.is_empty() && !is_final_turn {
                executed_any_tools = true;
                info!("ReActEngine: Turn {} produced {} tool call(s)", turn + 1, response.tool_calls.len());

                // Record Assistant turn with tool calls in history
                chat_messages.push(ChatMessage {
                    role: MessageRole::Assistant,
                    content: if response.content.trim().is_empty() { None } else { Some(response.content.clone()) },
                    tool_calls: Some(response.tool_calls.clone()),
                    tool_responses: None,
                });

                // Spawn concurrent futures for parallel tool execution
                let tool_futures = response.tool_calls.into_iter().map(|call| {
                    let registry = tool_registry.clone();
                    let app_handle = app.clone();
                    async move {
                        let _ = app_handle.emit("action_started", serde_json::json!({
                            "taskId": conversation_id,
                            "tool": call.name.clone(),
                            "params": call.arguments.clone(),
                            "description": format!("Executing tool '{}'", call.name)
                        }));

                        let exec_res = registry.execute_tool(&call.name, call.arguments.clone()).await;
                        match exec_res {
                            Ok(res) => {
                                let _ = app_handle.emit("action_completed", serde_json::json!({
                                    "taskId": conversation_id,
                                    "tool": call.name.clone(),
                                    "result": res.clone(),
                                    "success": true
                                }));
                                let raw_str = serde_json::to_string_pretty(&res).unwrap_or_else(|_| "Completed".to_string());
                                let distilled = ContextGuard::distill_tool_output(&call.name, &raw_str, 8000);
                                (call.id, call.name, Ok(distilled))
                            }
                            Err(e) => {
                                let _ = app_handle.emit("action_failed", serde_json::json!({
                                    "taskId": conversation_id,
                                    "tool": call.name.clone(),
                                    "error": e.to_string()
                                }));
                                (call.id, call.name, Err(e))
                            }
                        }
                    }
                });

                let results = futures::future::join_all(tool_futures).await;
                let mut native_responses = Vec::new();

                for (call_id, tool_name, res) in results {
                    let content_str = match res {
                        Ok(output) => output,
                        Err(err) => format!("Error executing '{}': {}", tool_name, err),
                    };
                    native_responses.push(NativeToolResponse {
                        id: call_id,
                        name: tool_name,
                        content: content_str,
                    });
                }

                // Batch-append Native Tool Response turn into context
                chat_messages.push(ChatMessage {
                    role: MessageRole::Tool,
                    content: None,
                    tool_calls: None,
                    tool_responses: Some(native_responses),
                });

                continue;
            }

            // No tool calls produced (or final turn) — grab text content
            if !response.content.trim().is_empty() {
                final_content = response.content;
                break;
            }
        }

        // Forced Synthesis Recovery Loop if content is empty but tools were executed
        if final_content.trim().is_empty() {
            if executed_any_tools {
                warn!("ReActEngine: Content was empty after tool execution. Running forced synthesis turn...");
                let synth_request = LlmRequest {
                    system_prompt: Some(format!(
                        "{}\n\nPlease synthesize all previously executed tool results into a clear, direct markdown answer for the user.",
                        system_prompt
                    )),
                    messages: chat_messages,
                    model: model.clone(),
                    max_tokens: Some(4096),
                    temperature: Some(0.3),
                    tools: None,
                };

                if let Ok(synth_res) = llm_client.generate(&synth_request).await {
                    if !synth_res.content.trim().is_empty() {
                        final_content = synth_res.content;
                    }
                }
            }

            if final_content.trim().is_empty() {
                final_content = "I executed the necessary actions but could not generate a textual summary. Please check the action details above.".to_string();
            }
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
