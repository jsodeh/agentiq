use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Instant;
use tracing::warn;

use super::{FinishReason, LlmClient, LlmRequest, LlmResponse, MessageRole, TokenUsage};
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

        let mut messages: Vec<Value> = Vec::new();

        for msg in &request.messages {
            match msg.role {
                MessageRole::User => {
                    messages.push(json!({
                        "role": "user",
                        "content": msg.content.clone().unwrap_or_default()
                    }));
                }
                MessageRole::Assistant => {
                    let mut content_blocks = Vec::new();
                    if let Some(text) = &msg.content {
                        if !text.is_empty() {
                            content_blocks.push(json!({ "type": "text", "text": text }));
                        }
                    }
                    if let Some(calls) = &msg.tool_calls {
                        for call in calls {
                            content_blocks.push(json!({
                                "type": "tool_use",
                                "id": call.id,
                                "name": call.name,
                                "input": call.arguments
                            }));
                        }
                    }
                    messages.push(json!({
                        "role": "assistant",
                        "content": content_blocks
                    }));
                }
                MessageRole::Tool => {
                    if let Some(responses) = &msg.tool_responses {
                        let blocks: Vec<Value> = responses
                            .iter()
                            .map(|r| {
                                json!({
                                    "type": "tool_result",
                                    "tool_use_id": r.id,
                                    "content": r.content
                                })
                            })
                            .collect();
                        messages.push(json!({
                            "role": "user",
                            "content": blocks
                        }));
                    }
                }
                MessageRole::System => {}
            }
        }

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

        let max_retries = 3;
        let mut attempts = 0;
        let res_json: Value = loop {
            attempts += 1;
            let res = match self
                .client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &self.api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) if attempts < max_retries => {
                    warn!("Anthropic API network attempt {} failed: {}. Retrying...", attempts, e);
                    tokio::time::sleep(tokio::time::Duration::from_millis(500 * attempts as u64)).await;
                    continue;
                }
                Err(e) => return Err(AppError::Llm { message: format!("HTTP send error: {}", e) }),
            };

            let status = res.status();
            if (status.as_u16() == 503 || status.as_u16() == 504 || status.as_u16() == 429) && attempts < max_retries {
                let delay = match attempts {
                    1 => 500,
                    2 => 1500,
                    _ => 3500,
                };
                warn!("Anthropic API returned status {}. Attempt {}/{} failed. Retrying in {}ms...", status, attempts, max_retries, delay);
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                continue;
            }

            if !status.is_success() {
                let err_text = res.text().await.unwrap_or_default();
                return Err(AppError::Llm {
                    message: format!("Anthropic API returned status {}: {}", status, err_text),
                });
            }

            match res.json::<Value>().await {
                Ok(val) => break val,
                Err(e) => return Err(AppError::Llm { message: format!("Failed to parse Anthropic JSON response: {}", e) }),
            }
        };

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

    async fn generate_stream(
        &self,
        request: &LlmRequest,
    ) -> Result<futures::stream::BoxStream<'static, Result<String, AppError>>, AppError> {
        use async_stream::try_stream;
        use futures::StreamExt;

        let model = if request.model.is_empty() {
            "claude-3-5-sonnet-20241022".to_string()
        } else {
            request.model.clone()
        };

        let mut body = json!({
            "model": model,
            "max_tokens": request.max_tokens.unwrap_or(4096),
            "stream": true,
            "messages": []
        });

        if let Some(sys) = &request.system_prompt {
            body["system"] = json!(sys);
        }

        let mut msgs: Vec<Value> = Vec::new();
        for msg in &request.messages {
            let role = match msg.role {
                MessageRole::User | MessageRole::Tool => "user",
                MessageRole::Assistant => "assistant",
                MessageRole::System => "user",
            };
            if let Some(c) = &msg.content {
                msgs.push(json!({ "role": role, "content": c }));
            }
        }
        body["messages"] = json!(msgs);

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
                message: format!("HTTP stream send error to Anthropic: {}", e),
            })?;

        let stream = try_stream! {
            let mut byte_stream = res.bytes_stream();
            let mut buffer = String::new();
            while let Some(item) = byte_stream.next().await {
                let bytes = item.map_err(|e| AppError::Llm { message: e.to_string() })?;
                buffer.push_str(&String::from_utf8_lossy(&bytes));
                while let Some(pos) = buffer.find('\n') {
                    let line = buffer[..pos].trim().to_string();
                    buffer.drain(..=pos);
                    if line.starts_with("data: ") {
                        let data = line[6..].trim();
                        if let Ok(json_val) = serde_json::from_str::<Value>(data) {
                            if json_val["type"] == "content_block_delta" {
                                if let Some(text) = json_val["delta"]["text"].as_str() {
                                    if !text.is_empty() {
                                        yield text.to_string();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        Ok(Box::pin(stream))
    }
}
