use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Instant;
use tracing::warn;

use super::{FinishReason, LlmClient, LlmRequest, LlmResponse, MessageRole, TokenUsage};
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
            match msg.role {
                MessageRole::User => {
                    messages.push(json!({
                        "role": "user",
                        "content": msg.content.clone().unwrap_or_default()
                    }));
                }
                MessageRole::Assistant => {
                    let mut msg_obj = json!({
                        "role": "assistant",
                        "content": msg.content.clone()
                    });
                    if let Some(calls) = &msg.tool_calls {
                        let calls_json: Vec<Value> = calls
                            .iter()
                            .map(|c| {
                                json!({
                                    "id": c.id,
                                    "type": "function",
                                    "function": {
                                        "name": c.name,
                                        "arguments": c.arguments.to_string()
                                    }
                                })
                            })
                            .collect();
                        msg_obj["tool_calls"] = json!(calls_json);
                    }
                    messages.push(msg_obj);
                }
                MessageRole::Tool => {
                    if let Some(responses) = &msg.tool_responses {
                        for resp in responses {
                            messages.push(json!({
                                "role": "tool",
                                "tool_call_id": resp.id,
                                "content": resp.content
                            }));
                        }
                    }
                }
                MessageRole::System => {
                    if let Some(sys) = &msg.content {
                        messages.push(json!({
                            "role": "system",
                            "content": sys
                        }));
                    }
                }
            }
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

        let max_retries = 3;
        let mut attempts = 0;
        let res_json: Value = loop {
            attempts += 1;
            let res = match self
                .client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", self.api_key))
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) if attempts < max_retries => {
                    warn!("OpenAI API network attempt {} failed: {}. Retrying...", attempts, e);
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
                warn!("OpenAI API returned status {}. Attempt {}/{} failed. Retrying in {}ms...", status, attempts, max_retries, delay);
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                continue;
            }

            if !status.is_success() {
                let err_text = res.text().await.unwrap_or_default();
                return Err(AppError::Llm {
                    message: format!("OpenAI API returned status {}: {}", status, err_text),
                });
            }

            match res.json::<Value>().await {
                Ok(val) => break val,
                Err(e) => return Err(AppError::Llm { message: format!("Failed to parse OpenAI JSON response: {}", e) }),
            }
        };

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

    async fn generate_stream(
        &self,
        request: &LlmRequest,
    ) -> Result<futures::stream::BoxStream<'static, Result<String, AppError>>, AppError> {
        use async_stream::try_stream;
        use futures::StreamExt;

        let model = if request.model.is_empty() {
            "gpt-4o-mini".to_string()
        } else {
            request.model.clone()
        };

        let mut body = json!({
            "model": model,
            "stream": true,
            "messages": []
        });

        let mut msgs: Vec<Value> = Vec::new();
        if let Some(sys) = &request.system_prompt {
            msgs.push(json!({ "role": "system", "content": sys }));
        }
        for msg in &request.messages {
            let role = match msg.role {
                MessageRole::User => "user",
                MessageRole::Assistant => "assistant",
                MessageRole::Tool => "tool",
                MessageRole::System => "system",
            };
            if let Some(c) = &msg.content {
                msgs.push(json!({ "role": role, "content": c }));
            }
        }
        body["messages"] = json!(msgs);

        let res = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Llm {
                message: format!("HTTP stream send error: {}", e),
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
                        if data == "[DONE]" {
                            break;
                        }
                        if let Ok(json_val) = serde_json::from_str::<Value>(data) {
                            if let Some(content) = json_val["choices"][0]["delta"]["content"].as_str() {
                                if !content.is_empty() {
                                    yield content.to_string();
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
