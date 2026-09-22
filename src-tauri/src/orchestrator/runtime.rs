use std::sync::Arc;
use std::time::Instant;

use serde_json::json;
use tauri::{AppHandle, Emitter};
use tracing::{error, info, warn};

use crate::agents::AgentPluginRegistry;
use crate::errors::AppError;
use crate::llm::{
    ChatMessage, LlmClient, LlmRequest, LlmResponse, MessageRole, NativeToolResponse,
    ToolDefinition,
};
use crate::orchestrator::context::ContextGuard;
use crate::orchestrator::suspension::SuspensionRegistry;
use crate::tools::ToolRegistry;

// ────────────────────────────────────────────────────────────────────────────
// ExecutionBudget — dynamic, multi-axis loop termination control
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ExecutionBudget {
    pub max_turns: usize,
    pub max_tokens: usize,
    pub max_duration_secs: u64,
    pub current_turns: usize,
    pub current_tokens: usize,
    pub start_time: Instant,
}

impl ExecutionBudget {
    /// Create a budget for interactive chat (generous defaults).
    pub fn for_chat() -> Self {
        Self {
            max_turns: 10,
            max_tokens: 100_000,
            max_duration_secs: 120,
            current_turns: 0,
            current_tokens: 0,
            start_time: Instant::now(),
        }
    }

    /// Create a budget for background tasks (tighter defaults).
    pub fn for_background_task() -> Self {
        Self {
            max_turns: 8,
            max_tokens: 60_000,
            max_duration_secs: 90,
            current_turns: 0,
            current_tokens: 0,
            start_time: Instant::now(),
        }
    }

    /// Create a budget for sub-agent child runtimes (scoped, smaller).
    pub fn for_subagent() -> Self {
        Self {
            max_turns: 5,
            max_tokens: 30_000,
            max_duration_secs: 45,
            current_turns: 0,
            current_tokens: 0,
            start_time: Instant::now(),
        }
    }

    /// Check if any of the three budget axes are exhausted.
    pub fn is_exhausted(&self) -> bool {
        self.current_turns >= self.max_turns
            || self.current_tokens >= self.max_tokens
            || self.start_time.elapsed().as_secs() >= self.max_duration_secs
    }

    /// Returns the remaining turns before hard cap.
    pub fn remaining_turns(&self) -> usize {
        self.max_turns.saturating_sub(self.current_turns)
    }

    /// Record tokens consumed on a given turn.
    pub fn record_token_usage(&mut self, prompt_tokens: u32, completion_tokens: u32) {
        self.current_tokens += (prompt_tokens + completion_tokens) as usize;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Sensitive tool detection — tools that require user approval
// ────────────────────────────────────────────────────────────────────────────

/// List of tool names that require explicit human approval before execution.
const SENSITIVE_TOOLS: &[&str] = &[
    "terminal_execute",
    "run_command",
    "shell_exec",
    "file_write",
    "file_delete",
    "send_email",
    "calendar_create_event",
    "payment_send",
];

fn is_sensitive_tool(tool_name: &str) -> bool {
    SENSITIVE_TOOLS.iter().any(|&s| tool_name == s)
}

// ────────────────────────────────────────────────────────────────────────────
// AgentExecutionRuntime — the unified ReAct execution loop
// ────────────────────────────────────────────────────────────────────────────

/// A single, reusable execution runtime that powers interactive chat,
/// background tasks, and sub-agent child processes through a shared loop.
pub struct AgentExecutionRuntime;

/// The output of a completed runtime loop.
pub struct RuntimeResult {
    pub final_content: String,
    pub tools_executed: bool,
    pub total_turns: usize,
    pub total_tokens: usize,
}

impl AgentExecutionRuntime {
    /// Execute the unified ReAct loop.
    ///
    /// This is the single authoritative execution path for all agent work:
    /// interactive chat, background tasks, and sub-agent children.
    ///
    /// # Arguments
    /// - `app`:               Tauri app handle for event emission (pass `None` for headless/sub-agent runs).
    /// - `task_id`:           Opaque identifier used for correlating telemetry events.
    /// - `llm_client`:        The provider-specific LLM client to call.
    /// - `system_prompt`:     Fully hydrated system prompt (soul + behaviour + skills + agent persona).
    /// - `chat_messages`:     Mutable conversation history; the runtime appends to this in-place.
    /// - `tool_registry`:     Shared registry of all available tools.
    /// - `tool_definitions`:  Pre-serialized tool schemas for the LLM request.
    /// - `model`:             Model identifier string (e.g., "gemini-2.5-flash").
    /// - `budget`:            Mutable budget that tracks turns, tokens, and wall-clock time.
    /// - `suspension_registry`: Registry for HITL approval channels (pass `None` to skip approvals).
    pub async fn run_loop(
        app: Option<&AppHandle>,
        task_id: i64,
        llm_client: &dyn LlmClient,
        system_prompt: &str,
        chat_messages: &mut Vec<ChatMessage>,
        tool_registry: &Arc<ToolRegistry>,
        tool_definitions: &[ToolDefinition],
        model: &str,
        budget: &mut ExecutionBudget,
        suspension_registry: Option<&Arc<SuspensionRegistry>>,
    ) -> Result<RuntimeResult, AppError> {
        let mut final_content = String::new();
        let mut executed_any_tools = false;

        // ── Main ReAct Loop ──────────────────────────────────────────────
        while !budget.is_exhausted() {
            budget.current_turns += 1;
            let turn = budget.current_turns;
            let remaining = budget.remaining_turns();

            info!(
                "Runtime[task={}]: Turn {}/{} (remaining: {}, tokens: {}/{})",
                task_id, turn, budget.max_turns, remaining, budget.current_tokens, budget.max_tokens
            );

            let is_final_turn = remaining == 0;

            // Emit warning when approaching budget limit
            if remaining == 1 {
                if let Some(app) = app {
                    let _ = app.emit(
                        "action_limit_warning",
                        json!({
                            "taskId": task_id,
                            "message": "Approaching action cap. Wrapping up execution..."
                        }),
                    );
                }
            }

            // Emit thinking telemetry
            if let Some(app) = app {
                let _ = app.emit(
                    "agent_thinking",
                    json!({
                        "taskId": task_id,
                        "reasoning": if turn == 1 {
                            "Analyzing user request and available tools...".to_string()
                        } else {
                            format!("Processing step {}...", turn)
                        },
                        "expectedOutcome": "Determining next action"
                    }),
                );
            }

            // Build turn-specific system prompt
            let turn_system_prompt = if is_final_turn {
                format!(
                    "{}\n\nALERT: This is your absolute final available execution turn. \
                     You are blocked from calling further tools. \
                     Synthesize all gathered facts into a complete answer.",
                    system_prompt
                )
            } else {
                system_prompt.to_string()
            };

            // Decide whether to provide tool schemas on this turn
            let turn_tools = if is_final_turn || tool_definitions.is_empty() {
                None
            } else {
                Some(tool_definitions.to_vec())
            };

            let request = LlmRequest {
                system_prompt: Some(turn_system_prompt),
                messages: chat_messages.clone(),
                model: model.to_string(),
                max_tokens: Some(4096),
                temperature: Some(0.3),
                tools: turn_tools,
            };

            // ── LLM Call ─────────────────────────────────────────────────
            let response: LlmResponse = match llm_client.generate(&request).await {
                Ok(res) => res,
                Err(e) => {
                    error!("Runtime[task={}]: LLM error on turn {}: {}", task_id, turn, e);
                    if let Some(app) = app {
                        let _ = app.emit(
                            "action_failed",
                            json!({
                                "taskId": task_id,
                                "tool": "llm_client",
                                "error": e.to_string()
                            }),
                        );
                    }
                    return Err(e);
                }
            };

            // Track token consumption
            budget.record_token_usage(
                response.tokens_used.prompt_tokens,
                response.tokens_used.completion_tokens,
            );

            // ── Tool Execution Branch ────────────────────────────────────
            if !response.tool_calls.is_empty() && !is_final_turn {
                executed_any_tools = true;
                info!(
                    "Runtime[task={}]: Turn {} produced {} tool call(s)",
                    task_id, turn, response.tool_calls.len()
                );

                // Record assistant turn with tool calls in context history
                chat_messages.push(ChatMessage {
                    role: MessageRole::Assistant,
                    content: if response.content.trim().is_empty() {
                        None
                    } else {
                        Some(response.content.clone())
                    },
                    tool_calls: Some(response.tool_calls.clone()),
                    tool_responses: None,
                });

                // Execute tool calls in parallel via join_all
                let tool_futures = response.tool_calls.into_iter().map(|call| {
                    let registry = tool_registry.clone();
                    let app_opt = app.cloned();
                    let suspension_reg = suspension_registry.cloned();

                    async move {
                        // ── HITL Approval Gate ────────────────────────
                        if is_sensitive_tool(&call.name) {
                            if let Some(ref sr) = suspension_reg {
                                info!(
                                    "Runtime[task={}]: Tool '{}' requires user approval",
                                    task_id, call.name
                                );

                                // Emit approval-required event to UI
                                if let Some(ref app) = app_opt {
                                    let _ = app.emit(
                                        "action_awaiting_approval",
                                        json!({
                                            "taskId": task_id,
                                            "approvalId": format!("approval-{}-{}", task_id, call.id),
                                            "tool": call.name.clone(),
                                            "params": call.arguments.clone(),
                                            "description": format!(
                                                "Agent wants to execute '{}'. Approve?",
                                                call.name
                                            )
                                        }),
                                    );
                                }

                                // Suspend: create a oneshot channel and wait
                                let approval_id =
                                    format!("approval-{}-{}", task_id, call.id);
                                let approved = sr.wait_for_approval(&approval_id).await;

                                if !approved {
                                    info!(
                                        "Runtime[task={}]: Tool '{}' DENIED by user",
                                        task_id, call.name
                                    );
                                    if let Some(ref app) = app_opt {
                                        let _ = app.emit(
                                            "action_failed",
                                            json!({
                                                "taskId": task_id,
                                                "tool": call.name.clone(),
                                                "error": "Execution denied by user"
                                            }),
                                        );
                                    }
                                    return (
                                        call.id,
                                        call.name,
                                        Ok::<String, AppError>(
                                            "Tool execution rejected by user.".to_string(),
                                        ),
                                    );
                                }

                                info!(
                                    "Runtime[task={}]: Tool '{}' APPROVED by user",
                                    task_id, call.name
                                );
                            }
                        }

                        // ── Normal tool execution ─────────────────────
                        if let Some(ref app) = app_opt {
                            let _ = app.emit(
                                "action_started",
                                json!({
                                    "taskId": task_id,
                                    "tool": call.name.clone(),
                                    "params": call.arguments.clone(),
                                    "description": format!("Executing tool '{}'", call.name)
                                }),
                            );
                        }

                        let exec_res =
                            registry.execute_tool(&call.name, call.arguments.clone()).await;

                        match exec_res {
                            Ok(res) => {
                                if let Some(ref app) = app_opt {
                                    let _ = app.emit(
                                        "action_completed",
                                        json!({
                                            "taskId": task_id,
                                            "tool": call.name.clone(),
                                            "result": res.clone(),
                                            "success": true
                                        }),
                                    );
                                }
                                let raw_str = serde_json::to_string_pretty(&res)
                                    .unwrap_or_else(|_| "Completed".to_string());
                                let distilled =
                                    ContextGuard::distill_tool_output(&call.name, &raw_str, 8000);
                                (call.id, call.name, Ok(distilled))
                            }
                            Err(e) => {
                                if let Some(ref app) = app_opt {
                                    let _ = app.emit(
                                        "action_failed",
                                        json!({
                                            "taskId": task_id,
                                            "tool": call.name.clone(),
                                            "error": e.to_string()
                                        }),
                                    );
                                }
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

                // Batch-append native tool response turn into context
                chat_messages.push(ChatMessage {
                    role: MessageRole::Tool,
                    content: None,
                    tool_calls: None,
                    tool_responses: Some(native_responses),
                });

                continue;
            }

            // ── Text Response Branch (no tool calls or final turn) ────────
            if !response.content.trim().is_empty() {
                final_content = response.content;
                break;
            }
        }

        // ── Forced Synthesis Recovery ─────────────────────────────────────
        if final_content.trim().is_empty() {
            if executed_any_tools {
                warn!(
                    "Runtime[task={}]: Content empty after tool execution. Running forced synthesis.",
                    task_id
                );

                let synth_request = LlmRequest {
                    system_prompt: Some(format!(
                        "{}\n\nPlease synthesize all previously executed tool results \
                         into a clear, direct markdown answer for the user.",
                        system_prompt
                    )),
                    messages: chat_messages.clone(),
                    model: model.to_string(),
                    max_tokens: Some(4096),
                    temperature: Some(0.3),
                    tools: None,
                };

                if let Ok(synth_res) = llm_client.generate(&synth_request).await {
                    budget.record_token_usage(
                        synth_res.tokens_used.prompt_tokens,
                        synth_res.tokens_used.completion_tokens,
                    );
                    if !synth_res.content.trim().is_empty() {
                        final_content = synth_res.content;
                    }
                }
            }

            if final_content.trim().is_empty() {
                final_content =
                    "I executed the necessary actions but could not generate a textual summary. \
                     Please check the action details above."
                        .to_string();
            }
        }

        // Emit task completed telemetry
        if let Some(app) = app {
            let _ = app.emit(
                "task_completed",
                json!({
                    "taskId": task_id,
                    "result": { "output": final_content.clone() }
                }),
            );
        }

        Ok(RuntimeResult {
            final_content,
            tools_executed: executed_any_tools,
            total_turns: budget.current_turns,
            total_tokens: budget.current_tokens,
        })
    }
}
