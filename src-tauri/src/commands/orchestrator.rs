use parking_lot::Mutex as ParkingMutex;
use std::sync::Arc;
use tauri::{Emitter, State};
use tracing::info;

use crate::config::{AppConfig, ExecutionMode, ModelSettings};
use crate::errors::AppError;
use crate::orchestrator::NativeOrchestratorState;

#[tauri::command]
pub async fn start_orchestrator(
    app: tauri::AppHandle,
    native_state: State<'_, NativeOrchestratorState>,
) -> Result<String, AppError> {
    info!("Starting Native Rust Agent Orchestrator...");
    native_state.start()?;

    let mut rx = native_state.event_bus.subscribe();
    let app_handle = app.clone();

    tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let event_type = match &event {
                crate::orchestrator::events::OrchestratorEvent::TaskStarted { .. } => {
                    "task_started"
                }
                crate::orchestrator::events::OrchestratorEvent::AgentThinking { .. } => {
                    "agent_thinking"
                }
                crate::orchestrator::events::OrchestratorEvent::ActionStarted { .. } => {
                    "action_started"
                }
                crate::orchestrator::events::OrchestratorEvent::ActionCompleted { .. } => {
                    "action_completed"
                }
                crate::orchestrator::events::OrchestratorEvent::ActionFailed { .. } => {
                    "action_failed"
                }
                crate::orchestrator::events::OrchestratorEvent::TaskCompleted { .. } => {
                    "task_completed"
                }
                crate::orchestrator::events::OrchestratorEvent::TaskFailed { .. } => "task_failed",
                crate::orchestrator::events::OrchestratorEvent::EscalationCreated { .. } => {
                    "escalation_created"
                }
            };

            let _ = app_handle.emit(event_type, &event);
        }
    });

    Ok("Native orchestrator started successfully".to_string())
}

#[tauri::command]
pub async fn stop_orchestrator(
    native_state: State<'_, NativeOrchestratorState>,
) -> Result<String, AppError> {
    info!("Stopping Native Rust Agent Orchestrator...");
    native_state.stop();
    Ok("Native orchestrator stopped successfully".to_string())
}

#[tauri::command]
pub fn get_orchestrator_status(
    native_state: State<'_, NativeOrchestratorState>,
) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({
        "running": native_state.is_running(),
        "active_agents": 0,
        "queue_size": 0,
    }))
}

#[tauri::command]
pub fn get_llm_config(
    config_state: State<'_, Arc<ParkingMutex<AppConfig>>>,
) -> Result<AppConfig, AppError> {
    let cfg = config_state.lock().clone();
    Ok(cfg)
}

#[tauri::command]
pub fn update_llm_config(
    mode: Option<String>,
    models: Option<ModelSettings>,
    config_state: State<'_, Arc<ParkingMutex<AppConfig>>>,
) -> Result<AppConfig, AppError> {
    info!("[Settings] update_llm_config called — mode={:?}", mode);
    let mut cfg = config_state.lock();

    if let Some(mode_str) = mode {
        match mode_str.to_lowercase().as_str() {
            "cloud" => cfg.mode = ExecutionMode::Cloud,
            "local" => cfg.mode = ExecutionMode::Local,
            _ => {}
        }
    }

    if let Some(m) = models {
        info!("[Settings] Updating models — provider={}, cloud_model={}, gemini_key_present={}",
            m.cloud_provider,
            m.cloud_model,
            m.gemini_api_key.is_some()
        );
        cfg.models = m;
    }

    info!("[Settings] Saving config — mode={:?}, provider={}, model={}",
        cfg.mode, cfg.models.cloud_provider, cfg.models.cloud_model);
    cfg.save()?;
    Ok(cfg.clone())
}
