use parking_lot::Mutex;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tracing::info;
use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::database::DbPool;
use crate::errors::AppError;
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
    info!("Chat message received for conversation {}", conversation_id);
    crate::orchestrator::react_engine::ReActEngine::execute_chat_turn(
        &app,
        &pool,
        &config,
        &agent_registry,
        conversation_id,
        &message,
    )
    .await
}


