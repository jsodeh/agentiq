use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Instant;

use super::{FinishReason, LlmClient, LlmRequest, LlmResponse, TokenUsage};
use crate::errors::AppError;

pub struct OpenAiClient {
    api_key: String,
    client: Client,
}

impl OpenAiClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl LlmClient for OpenAiClient {
    async fn generate(&self, request: &LlmRequest) -> Result<LlmResponse, AppError> {
        let start = Instant::now();

        let model = if request.model.is_empty() {
            "gpt-4o".to_string()
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

        let mut body = json!({
            "model": model,
            "messages": messages
        });

        if let Some(max_tok) = request.max_tokens {
            body["max_tokens"] = json!(max_tok);
        }

        if let Some(temp) = request.temperature {
            body["temperature"] = json!(temp);
        }

        if let Some(tools) = &request.tools {
            let tools_json: Vec<Value> = tools
                .iter()
                .map(|t| {
                    json!({
                        "type": "function",
                        "function": {
                            "name": t.name,
                            "description": t.description,
                            "parameters": t.parameters
                        }
                    })
                })
                .collect();
            body["tools"] = json!(tools_json);
        }

        let res = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
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
                message: format!("OpenAI API returned status {}: {}", status, err_text),
            });
        }

        let res_json: Value = res.json().await.map_err(|e| AppError::Llm {
            message: format!("Failed to parse JSON response: {}", e),
        })?;

        let duration = start.elapsed().as_millis() as u64;

        let choice = &res_json["choices"][0];
        let content = choice["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let mut tool_calls = Vec::new();
        if let Some(tc_arr) = choice["message"]["tool_calls"].as_array() {
            for item in tc_arr {
                let id = item["id"].as_str().unwrap_or("").to_string();
                let name = item["function"]["name"].as_str().unwrap_or("").to_string();
                let args_str = item["function"]["arguments"].as_str().unwrap_or("{}");
                let args: Value = serde_json::from_str(args_str).unwrap_or(json!({}));
                tool_calls.push(super::ToolCall {
                    id,
                    name,
                    arguments: args,
                });
            }
        }

        let usage = TokenUsage {
            prompt_tokens: res_json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: res_json["usage"]["completion_tokens"]
                .as_u64()
                .unwrap_or(0) as u32,
            total_tokens: res_json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
        };

        let finish_str = choice["finish_reason"].as_str().unwrap_or("stop");
        let finish_reason = match finish_str {
            "stop" => FinishReason::Stop,
            "length" => FinishReason::Length,
            "tool_calls" => FinishReason::ToolCalls,
            other => FinishReason::Error(other.to_string()),
        };

        Ok(LlmResponse {
            content,
            model,
            tokens_used: usage,
            finish_reason,
            tool_calls,
            response_time_ms: duration,
        })
    }
}
