pub mod anthropic;
pub mod gemini;
pub mod ollama;
pub mod openai;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmRequest {
    pub system_prompt: Option<String>,
    pub messages: Vec<ChatMessage>,
    pub model: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub tools: Option<Vec<ToolDefinition>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FinishReason {
    Stop,
    Length,
    ToolCalls,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmResponse {
    pub content: String,
    pub model: String,
    pub tokens_used: TokenUsage,
    pub finish_reason: FinishReason,
    pub tool_calls: Vec<ToolCall>,
    pub response_time_ms: u64,
}

#[async_trait]
pub trait LlmClient: Send + Sync {
    async fn generate(&self, request: &LlmRequest) -> Result<LlmResponse, AppError>;
}

pub fn create_llm_client(
    provider: &str,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<Box<dyn LlmClient>, AppError> {
    match provider.to_lowercase().as_str() {
        "anthropic" => {
            let key = api_key
                .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok())
                .ok_or_else(|| AppError::Config("Anthropic API key is required".into()))?;
            Ok(Box::new(anthropic::AnthropicClient::new(key)))
        }
        "openai" => {
            let key = api_key
                .or_else(|| std::env::var("OPENAI_API_KEY").ok())
                .ok_or_else(|| AppError::Config("OpenAI API key is required".into()))?;
            Ok(Box::new(openai::OpenAiClient::new(key)))
        }
        "gemini" | "google" => {
            let key = api_key
                .or_else(|| std::env::var("GEMINI_API_KEY").ok())
                .ok_or_else(|| AppError::Config("Gemini API key is required".into()))?;
            Ok(Box::new(gemini::GeminiClient::new(key)))
        }
        "ollama" | "local" => {
            let ep = endpoint
                .or_else(|| std::env::var("OLLAMA_ENDPOINT").ok())
                .unwrap_or_else(|| "http://localhost:11434".into());
            Ok(Box::new(ollama::OllamaClient::new(ep)))
        }
        _ => Err(AppError::Config(format!(
            "Unsupported LLM provider: {}",
            provider
        ))),
    }
}
