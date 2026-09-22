use serde_json::json;
use std::sync::Arc;

use crate::agents::config::AgentPluginRegistry;
use crate::database::models::Task;
use crate::database::queries::{self, Queries};
use crate::database::DbPool;
use crate::errors::AppError;
use crate::llm::{ChatMessage, LlmClient, MessageRole};
use crate::orchestrator::events::{EventBus, OrchestratorEvent};
use crate::orchestrator::master::MasterOrchestrator;
use crate::orchestrator::runtime::{AgentExecutionRuntime, ExecutionBudget};
use crate::tools::ToolRegistry;

pub struct TaskExecutor;

impl TaskExecutor {
    pub async fn execute_task(
        task: Task,
        pool: DbPool,
        llm: Arc<dyn LlmClient>,
        tools: Arc<ToolRegistry>,
        event_bus: Arc<EventBus>,
        agent_registry: Arc<AgentPluginRegistry>,
        model_name: String,
    ) -> Result<(), AppError> {
        let task_id = task.id;
        let agent_id = task.agent_id;
        let task_desc = task.description.clone();

        // 1. Notify TaskStarted
        event_bus.publish(OrchestratorEvent::TaskStarted {
            task_id,
            agent_id,
            description: task_desc.clone(),
        });

        let conn = pool.get()?;
        queries::update_task_status(&conn, task_id, "in_progress", None)?;
        queries::create_log(&conn, task_id, agent_id, "info", "Task started", None)?;
        drop(conn);

        // 2. Load agent config/prompt & build hydrated system prompt
        let agent_type = {
            let conn = pool.get()?;
            queries::get_agent_by_id(&conn, agent_id)?
                .map(|a| a.r#type)
                .unwrap_or_else(|| "default".into())
        };

        let system_prompt = MasterOrchestrator::build_hydrated_system_prompt(
            &pool,
            &agent_registry,
            &agent_type,
        );

        // 3. Load recent conversation history for context
        let mut chat_messages: Vec<ChatMessage> = {
            let conn = pool.get()?;
            let conv_id_opt: Option<i64> = conn
                .query_row(
                    "SELECT id FROM conversations WHERE agent_id = ?1 ORDER BY created_at DESC LIMIT 1",
                    rusqlite::params![agent_id],
                    |row| row.get(0),
                )
                .ok();

            if let Some(conv_id) = conv_id_opt {
                match Queries::get_conversation_messages(&conn, conv_id) {
                    Ok(msgs) => {
                        let slice = if msgs.len() > 12 {
                            &msgs[msgs.len() - 12..]
                        } else {
                            &msgs[..]
                        };
                        slice
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
                            .collect()
                    }
                    Err(_) => vec![],
                }
            } else {
                vec![]
            }
        };

        // Ensure the current task description is the final user message
        if chat_messages.is_empty()
            || chat_messages.last().map(|m| &m.role) != Some(&MessageRole::User)
        {
            chat_messages.push(ChatMessage {
                role: MessageRole::User,
                content: Some(task_desc.clone()),
                tool_calls: None,
                tool_responses: None,
            });
        }

        // 4. Emit AgentThinking
        event_bus.publish(OrchestratorEvent::AgentThinking {
            task_id,
            agent_id,
            reasoning: format!("Executing background task: {}", task_desc),
            expected_outcome: Some("Task completion with tool usage".to_string()),
        });

        // 5. Create a dynamic execution budget for background tasks
        let mut budget = ExecutionBudget::for_background_task();

        // 6. Get tool definitions
        let tool_definitions = tools.get_tool_definitions();

        // 7. Delegate to the Unified Runtime (headless — no AppHandle)
        let result = AgentExecutionRuntime::run_loop(
            None, // No app handle for background tasks
            task_id,
            llm.as_ref(),
            &system_prompt,
            &mut chat_messages,
            &tools,
            &tool_definitions,
            &model_name,
            &mut budget,
            None, // No HITL approvals for background tasks
            None, // No parent task ID for background tasks
            Some(&pool),
        )
        .await;


        match result {
            Ok(runtime_result) => {
                let final_result = json!({
                    "output": runtime_result.final_content,
                    "turns_used": runtime_result.total_turns,
                    "tokens_used": runtime_result.total_tokens,
                    "tools_executed": runtime_result.tools_executed,
                });

                event_bus.publish(OrchestratorEvent::TaskCompleted {
                    task_id,
                    agent_id,
                    result: final_result.clone(),
                });

                let conn = pool.get()?;
                queries::update_task_status(
                    &conn,
                    task_id,
                    "completed",
                    Some(&final_result.to_string()),
                )?;
                queries::create_log(
                    &conn,
                    task_id,
                    agent_id,
                    "info",
                    "Task execution finished",
                    Some(&final_result.to_string()),
                )?;
            }
            Err(e) => {
                let err_msg = format!("Task execution failed: {}", e);
                event_bus.publish(OrchestratorEvent::TaskFailed {
                    task_id,
                    agent_id,
                    error: err_msg.clone(),
                });

                let conn = pool.get()?;
                queries::update_task_status(&conn, task_id, "failed", None)?;
                queries::create_log(&conn, task_id, agent_id, "error", &err_msg, None)?;
                return Err(e);
            }
        }

        Ok(())
    }
}
