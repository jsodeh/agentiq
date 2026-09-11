use serde_json::json;
use std::sync::Arc;

use crate::agents::config::AgentPluginRegistry;
use crate::database::models::Task;
use crate::database::queries::{self, Queries};
use crate::database::DbPool;
use crate::errors::AppError;
use crate::llm::{ChatMessage, LlmClient, LlmRequest};
use crate::orchestrator::events::{EventBus, OrchestratorEvent};
use crate::orchestrator::parser::ResponseParser;
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

        // 2. Load agent config/prompt
        let agent_type = {
            let conn = pool.get()?;
            queries::get_agent_by_id(&conn, agent_id)?
                .map(|a| a.r#type)
                .unwrap_or_else(|| "default".into())
        };

        let system_prompt = if let Some(plugin) = agent_registry.get(&agent_type) {
            plugin.system_prompt.clone()
        } else {
            format!(
                "You are AgentIQ, an intelligent AI agent (role: '{}'). \
                Analyze the user's task and respond naturally. \
                If you need to execute tools, produce a JSON action plan in this format: \
                {{\"reasoning\": \"...\", \"expected_outcome\": \"...\", \"actions\": [{{\"tool\": \"web_search\", \"params\": {{\"query\": \"...\"}}, \"description\": \"...\"}}]}}. \
                For simple conversational responses, reply directly in plain text without a JSON block.",
                agent_type
            )
        };

        // 3. Load recent conversation history for this agent to give context
        let conversation_messages: Vec<ChatMessage> = {
            let conn = pool.get()?;
            // Find the most recent conversation for this agent
            let conv_id_opt: Option<i64> = conn.query_row(
                "SELECT id FROM conversations WHERE agent_id = ?1 ORDER BY created_at DESC LIMIT 1",
                rusqlite::params![agent_id],
                |row| row.get(0),
            ).ok();

            if let Some(conv_id) = conv_id_opt {
                match Queries::get_conversation_messages(&conn, conv_id) {
                    Ok(msgs) => {
                        // Take up to last 12 messages (6 turns) for context window efficiency
                        let slice = if msgs.len() > 12 { &msgs[msgs.len()-12..] } else { &msgs[..] };
                        slice.iter().map(|m| ChatMessage {
                            role: m.role.clone(),
                            content: m.content.clone(),
                        }).collect()
                    }
                    Err(_) => vec![],
                }
            } else {
                // No prior conversation — seed with current task as user message
                vec![ChatMessage {
                    role: "user".to_string(),
                    content: task_desc.clone(),
                }]
            }
        };

        // 4. Build prompt and call LLM (use history if available, else task description alone)
        let mut messages = conversation_messages;
        // Ensure the current task description is the final user message if history didn't include it
        if messages.is_empty() || messages.last().map(|m| m.role.as_str()) != Some("user") {
            messages.push(ChatMessage {
                role: "user".to_string(),
                content: task_desc.clone(),
            });
        }

        let request = LlmRequest {
            system_prompt: Some(system_prompt),
            messages,
            model: model_name,
            max_tokens: Some(2048),
            temperature: Some(0.7),
            tools: None,
        };

        let llm_res = match llm.generate(&request).await {
            Ok(res) => res,
            Err(e) => {
                let err_msg = format!("LLM generation failed: {}", e);
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
        };

        // 4. Parse execution plan
        let plan = match ResponseParser::parse(&llm_res.content) {
            Ok(p) => p,
            Err(_e) => {
                let fallback_msg = format!("LLM completed task with summary: {}", llm_res.content);
                event_bus.publish(OrchestratorEvent::TaskCompleted {
                    task_id,
                    agent_id,
                    result: json!({ "output": llm_res.content }),
                });
                let conn = pool.get()?;
                queries::update_task_status(
                    &conn,
                    task_id,
                    "completed",
                    Some(&json!({ "output": llm_res.content }).to_string()),
                )?;
                queries::create_log(&conn, task_id, agent_id, "info", &fallback_msg, None)?;
                return Ok(());
            }
        };

        // 5. Notify AgentThinking
        event_bus.publish(OrchestratorEvent::AgentThinking {
            task_id,
            agent_id,
            reasoning: plan.reasoning.clone(),
            expected_outcome: plan.expected_outcome.clone(),
        });

        // 6. Execute actions in plan
        let mut results = Vec::new();
        for action in &plan.actions {
            event_bus.publish(OrchestratorEvent::ActionStarted {
                task_id,
                agent_id,
                tool: action.tool.clone(),
                params: action.params.clone(),
                description: action.description.clone(),
            });

            match tools.execute_tool(&action.tool, action.params.clone()).await {
                Ok(res) => {
                    event_bus.publish(OrchestratorEvent::ActionCompleted {
                        task_id,
                        agent_id,
                        tool: action.tool.clone(),
                        result: res.clone(),
                        success: true,
                    });
                    results.push(json!({
                        "tool": action.tool,
                        "success": true,
                        "result": res
                    }));
                }
                Err(err) => {
                    let err_str = err.to_string();
                    event_bus.publish(OrchestratorEvent::ActionFailed {
                        task_id,
                        agent_id,
                        tool: action.tool.clone(),
                        error: err_str.clone(),
                    });
                    results.push(json!({
                        "tool": action.tool,
                        "success": false,
                        "error": err_str
                    }));
                }
            }
        }

        // 7. Complete Task
        let final_result = json!({
            "reasoning": plan.reasoning,
            "actions": results
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

        Ok(())
    }
}
