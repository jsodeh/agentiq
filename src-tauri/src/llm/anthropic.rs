use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Instant;

use super::{FinishReason, LlmClient, LlmRequest, LlmResponse, TokenUsage};
use crate::errors::AppError;

pub struct AnthropicClient {
    api_key: String,
    client: Client,
}

impl AnthropicClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl LlmClient for AnthropicClient {
    async fn generate(&self, request: &LlmRequest) -> Result<LlmResponse, AppError> {
        let start = Instant::now();

        let model = if request.model.is_empty() {
            "claude-3-5-sonnet-20241022".to_string()
        } else {
            request.model.clone()
        };

        let messages: Vec<Value> = request
            .messages
            .iter()
            .map(|msg| {
                json!({
                    "role": match msg.role.as_str() {
                        "user" => "user",
                        "assistant" => "assistant",
                        _ => "user",
                    },
                    "content": msg.content
                })
            })
            .collect();

        let mut body = json!({
            "model": model,
            "max_tokens": request.max_tokens.unwrap_or(4096),
            "messages": messages
        });

        if let Some(sys) = &request.system_prompt {
            body["system"] = json!(sys);
        }

        if let Some(temp) = request.temperature {
            body["temperature"] = json!(temp);
        }

        if let Some(tools) = &request.tools {
            let tools_json: Vec<Value> = tools
                .iter()
                .map(|t| {
                    json!({
                        "name": t.name,
                        "description": t.description,
                        "input_schema": t.parameters
                    })
                })
                .collect();
            body["tools"] = json!(tools_json);
        }

        let res = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Llm {
                message: format!("HTTP send error: {}", e),
            })?;

        let status = res.status();
        if !status.is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(AppError::Llm {
                message: format!("Anthropic API returned status {}: {}", status, err_text),
            });
        }

        let res_json: Value = res.json().await.map_err(|e| AppError::Llm {
            message: format!("Failed to parse JSON response: {}", e),
        })?;

        let duration = start.elapsed().as_millis() as u64;

        let mut text_content = String::new();
        let mut tool_calls = Vec::new();

        if let Some(content_arr) = res_json["content"].as_array() {
            for item in content_arr {
                if item["type"] == "text" {
                    if let Some(t) = item["text"].as_str() {
                        text_content.push_str(t);
                    }
                } else if item["type"] == "tool_use" {
                    let id = item["id"].as_str().unwrap_or("").to_string();
                    let name = item["name"].as_str().unwrap_or("").to_string();
                    let args = item["input"].clone();
                    tool_calls.push(super::ToolCall {
                        id,
                        name,
                        arguments: args,
                    });
                }
            }
        }

        let usage = TokenUsage {
            prompt_tokens: res_json["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: res_json["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32,
            total_tokens: (res_json["usage"]["input_tokens"].as_u64().unwrap_or(0)
                + res_json["usage"]["output_tokens"].as_u64().unwrap_or(0))
                as u32,
        };

        let stop_reason = res_json["stop_reason"].as_str().unwrap_or("end_turn");
        let finish_reason = match stop_reason {
            "end_turn" | "stop_sequence" => FinishReason::Stop,
            "max_tokens" => FinishReason::Length,
            "tool_use" => FinishReason::ToolCalls,
            other => FinishReason::Error(other.to_string()),
        };

        Ok(LlmResponse {
            content: text_content,
            model,
            tokens_used: usage,
            finish_reason,
            tool_calls,
            response_time_ms: duration,
        })
    }
}
