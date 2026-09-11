use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Instant;

use super::{FinishReason, LlmClient, LlmRequest, LlmResponse, TokenUsage};
use crate::errors::AppError;

pub struct OllamaClient {
    endpoint: String,
    client: Client,
}

impl OllamaClient {
    pub fn new(endpoint: String) -> Self {
        Self {
            endpoint: endpoint.trim_end_matches('/').to_string(),
            client: Client::new(),
        }
    }
}

#[async_trait]
impl LlmClient for OllamaClient {
    async fn generate(&self, request: &LlmRequest) -> Result<LlmResponse, AppError> {
        let start = Instant::now();

        let model = if request.model.is_empty() {
            "llama3.2:3b".to_string()
        } else {
            request.model.clone()
        };

        let mut messages = Vec::new();
        if let Some(sys) = &request.system_prompt {
            messages.push(json!({
                "role": "system",
                "content": sys
            }));
        }

        for msg in &request.messages {
            messages.push(json!({
                "role": msg.role,
                "content": msg.content
            }));
        }

        let mut options = json!({});
        if let Some(temp) = request.temperature {
            options["temperature"] = json!(temp);
        }

        let body = json!({
            "model": model,
            "messages": messages,
            "stream": false,
            "options": options
        });

        let url = format!("{}/api/chat", self.endpoint);
        let res = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Llm {
                message: format!("HTTP send error to Ollama ({}): {}", url, e),
            })?;

        let status = res.status();
        if !status.is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(AppError::Llm {
                message: format!("Ollama API returned status {}: {}", status, err_text),
            });
        }

        let res_json: Value = res.json().await.map_err(|e| AppError::Llm {
            message: format!("Failed to parse Ollama JSON response: {}", e),
        })?;

        let duration = start.elapsed().as_millis() as u64;

        let content = res_json["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let prompt_tokens = res_json["prompt_eval_count"].as_u64().unwrap_or(0) as u32;
        let eval_tokens = res_json["eval_count"].as_u64().unwrap_or(0) as u32;

        let usage = TokenUsage {
            prompt_tokens,
            completion_tokens: eval_tokens,
            total_tokens: prompt_tokens + eval_tokens,
        };

        let finish_reason = if res_json["done"].as_bool().unwrap_or(false) {
            FinishReason::Stop
        } else {
            FinishReason::Length
        };

        Ok(LlmResponse {
            content,
            model,
            tokens_used: usage,
            finish_reason,
            tool_calls: Vec::new(),
            response_time_ms: duration,
        })
    }
}
