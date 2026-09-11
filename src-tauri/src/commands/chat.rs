use parking_lot::Mutex;
use std::sync::Arc;
use tauri::State;
use tracing::{error, info};
use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::database::queries::Queries;
use crate::database::DbPool;
use crate::errors::AppError;
use crate::llm::{create_llm_client, ChatMessage, LlmRequest};

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message_id: i64,
    pub content: String,
}

#[tauri::command]
pub async fn send_chat_message(
    pool: State<'_, DbPool>,
    config: State<'_, Arc<Mutex<AppConfig>>>,
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

    let chat_messages: Vec<ChatMessage> = history_slice
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

    let request = LlmRequest {
        system_prompt: Some(
            "You are AgentIQ, an intelligent, agile, and friendly AI assistant. Answer user questions directly, concisely, and helpfully.".to_string()
        ),
        messages: chat_messages,
        model,
        max_tokens: Some(1024),
        temperature: Some(0.7),
        tools: None,
    };

    // 4. Generate direct LLM response
    let response = llm_client.generate(&request).await.map_err(|e| {
        error!("Direct chat LLM error: {}", e);
        e
    })?;

    // 5. Save assistant response to DB
    let conn = pool.get()?;
    let assistant_msg_id = Queries::add_message(&conn, conversation_id, "assistant", &response.content)?;

    Ok(ChatResponse {
        message_id: assistant_msg_id,
        content: response.content,
    })
}
