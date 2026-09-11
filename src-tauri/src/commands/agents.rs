use std::sync::Arc;
use tauri::State;
use tracing::info;
use crate::agents::AgentPluginRegistry;
use crate::errors::AppError;

#[tauri::command]
pub fn start_agent(agent_id: i32) -> Result<String, AppError> {
    info!("Starting agent: {}", agent_id);
    Ok(format!("Agent {} started", agent_id))
}

#[tauri::command]
pub fn stop_agent(agent_id: i32) -> Result<String, AppError> {
    info!("Stopping agent: {}", agent_id);
    Ok(format!("Agent {} stopped", agent_id))
}

#[tauri::command]
pub fn stop_all_agents() -> Result<String, AppError> {
    info!("Stopping all agents");
    Ok("All agents stopped".to_string())
}

#[tauri::command]
pub fn prepare_task(
    registry: State<'_, Arc<AgentPluginRegistry>>,
    description: String,
) -> Result<serde_json::Value, AppError> {
    let (agent_id, agent_name, activated_tools) = registry.route_request(&description);

    Ok(serde_json::json!({
        "task_id": format!("task-{}", chrono::Utc::now().timestamp_millis()),
        "agent_id": agent_id,
        "agent_name": agent_name,
        "activated_tools": activated_tools,
        "status": "prepared",
    }))
}

#[tauri::command]
pub fn save_agent_configs(configs: serde_json::Value) -> Result<(), AppError> {
    info!("Saving agent configs: {:?}", configs);
    Ok(())
}
