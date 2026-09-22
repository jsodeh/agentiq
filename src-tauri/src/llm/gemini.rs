use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Instant;
use tracing::warn;

use super::{FinishReason, LlmClient, LlmRequest, LlmResponse, MessageRole, TokenUsage};
use crate::errors::AppError;

pub struct GeminiClient {
    api_key: String,
    client: Client,
}

impl GeminiClient {
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            api_key,
            client,
        }
    }
}

#[async_trait]
impl LlmClient for GeminiClient {
    async fn generate(&self, request: &LlmRequest) -> Result<LlmResponse, AppError> {
        let start = Instant::now();

        let model = if request.model.is_empty() || request.model == "gemini-1.5-flash" || request.model == "gemini-2.5-flash" {
            "gemini-3.6-flash".to_string()
        } else {
            request.model.clone()
        };

        let mut contents: Vec<Value> = Vec::new();

        for msg in &request.messages {
            match msg.role {
                MessageRole::User => {
                    let mut parts = Vec::new();
                    if let Some(text) = &msg.content {
                        if !text.is_empty() {
                            parts.push(json!({ "text": text }));
                        }
                    }
                    if !parts.is_empty() {
                        contents.push(json!({
                            "role": "user",
                            "parts": parts
                        }));
                    }
                }
                MessageRole::Assistant => {
                    let mut parts = Vec::new();
                    if let Some(text) = &msg.content {
                        if !text.is_empty() {
                            parts.push(json!({ "text": text }));
                        }
                    }
                    if let Some(calls) = &msg.tool_calls {
                        for call in calls {
                            parts.push(json!({
                                "functionCall": {
                                    "name": call.name,
                                    "args": call.arguments
                                }
                            }));
                        }
                    }
                    if !parts.is_empty() {
                        contents.push(json!({
                            "role": "model",
                            "parts": parts
                        }));
                    }
                }
                MessageRole::Tool => {
                    if let Some(responses) = &msg.tool_responses {
                        for resp in responses {
                            let resp_val = serde_json::from_str::<Value>(&resp.content)
                                .unwrap_or_else(|_| json!({ "result": resp.content }));
                            contents.push(json!({
                                "role": "user",
                                "parts": [{
                                    "functionResponse": {
                                        "name": resp.name,
                                        "response": resp_val
                                    }
                                }]
                            }));
                        }
                    }
                }
                MessageRole::System => {
                    // System prompt handled in system_instruction
                }
            }
        }

        let mut body = json!({
            "contents": contents,
        });

        if let Some(sys) = &request.system_prompt {
            body["system_instruction"] = json!({
                "parts": [{"text": sys}]
            });
        }

        if let Some(temp) = request.temperature {
            body["generationConfig"] = json!({
                "temperature": temp,
            });
        }

        if let Some(tools) = &request.tools {
            let decls: Vec<Value> = tools
                .iter()
                .map(|t| {
                    json!({
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters
                    })
                })
                .collect();
            body["tools"] = json!([{
                "functionDeclarations": decls
            }]);
        }

        let is_oauth = self.api_key.starts_with("ya29.");
        let url = if is_oauth {
            format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent", model)
        } else {
            format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, self.api_key
            )
        };

        // Outbound retry machine for 503, 504, 429
        let max_retries = 3;
        let mut attempts = 0;
        let res_json: Value = loop {
            attempts += 1;
            let mut req_builder = self
                .client
                .post(&url)
                .header("content-type", "application/json");

            if is_oauth {
                req_builder = req_builder.header("authorization", format!("Bearer {}", self.api_key));
            } else {
                req_builder = req_builder.header("x-goog-api-key", &self.api_key);
            }

            let res = match req_builder.json(&body).send().await {
                Ok(r) => r,
                Err(e) if attempts < max_retries => {
                    warn!("Gemini API network attempt {} failed: {}. Retrying...", attempts, e);
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
                warn!("Gemini API returned status {}. Attempt {}/{} failed. Retrying in {}ms...", status, attempts, max_retries, delay);
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                continue;
            }

            if !status.is_success() {
                let err_text = res.text().await.unwrap_or_default();
                return Err(AppError::Llm {
                    message: format!("Gemini API returned status {}: {}", status, err_text),
                });
            }

            match res.json::<Value>().await {
                Ok(val) => break val,
                Err(e) => return Err(AppError::Llm { message: format!("Failed to parse Gemini JSON response: {}", e) }),
            }
        };

        let duration = start.elapsed().as_millis() as u64;

        let mut text_content = String::new();
        let mut tool_calls = Vec::new();
        if let Some(candidates) = res_json["candidates"].as_array() {
            if let Some(first) = candidates.first() {
                if let Some(parts) = first["content"]["parts"].as_array() {
                    for (idx, part) in parts.iter().enumerate() {
                        if let Some(t) = part["text"].as_str() {
                            text_content.push_str(t);
                        }
                        if let Some(fc) = part.get("functionCall") {
                            let name = fc["name"].as_str().unwrap_or("").to_string();
                            let args = fc["args"].clone();
                            tool_calls.push(super::ToolCall {
                                id: format!("gemini_call_{}", idx),
                                name,
                                arguments: args,
                            });
                        }
                    }
                }
            }
        }

        let prompt_tokens = res_json["usageMetadata"]["promptTokenCount"].as_u64().unwrap_or(0) as u32;
        let completion_tokens = res_json["usageMetadata"]["candidatesTokenCount"].as_u64().unwrap_or(0) as u32;
        let total_tokens = res_json["usageMetadata"]["totalTokenCount"].as_u64().unwrap_or(0) as u32;

        let usage = TokenUsage {
            prompt_tokens,
            completion_tokens,
            total_tokens: if total_tokens > 0 { total_tokens } else { prompt_tokens + completion_tokens },
        };

        let finish_reason = if !tool_calls.is_empty() {
            FinishReason::ToolCalls
        } else {
            FinishReason::Stop
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

        let model = if request.model.is_empty() || request.model == "gemini-1.5-flash" || request.model == "gemini-2.5-flash" {
            "gemini-3.6-flash".to_string()
        } else {
            request.model.clone()
        };

        let mut contents: Vec<Value> = Vec::new();
        for msg in &request.messages {
            let role_str = match msg.role {
                MessageRole::User => "user",
                MessageRole::Assistant => "model",
                MessageRole::Tool => "user",
                MessageRole::System => "user",
            };
            if let Some(text) = &msg.content {
                if !text.is_empty() {
                    contents.push(json!({
                        "role": role_str,
                        "parts": [{ "text": text }]
                    }));
                }
            }
        }

        let mut body = json!({ "contents": contents });
        if let Some(sys) = &request.system_prompt {
            body["systemInstruction"] = json!({
                "parts": [{ "text": sys }]
            });
        }

        let is_oauth = self.api_key.starts_with("ya29.");
        let url = if is_oauth {
            format!("https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse", model)
        } else {
            format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
                model, self.api_key
            )
        };

        let mut req_builder = self.client.post(&url).header("content-type", "application/json");
        if is_oauth {
            req_builder = req_builder.header("authorization", format!("Bearer {}", self.api_key));
        } else {
            req_builder = req_builder.header("x-goog-api-key", &self.api_key);
        }

        let res = req_builder.json(&body).send().await.map_err(|e| AppError::Llm {
            message: format!("HTTP stream send error to Gemini: {}", e),
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
                            if let Some(candidates) = json_val["candidates"].as_array() {
                                if let Some(first) = candidates.first() {
                                    if let Some(parts) = first["content"]["parts"].as_array() {
                                        for part in parts {
                                            if let Some(t) = part["text"].as_str() {
                                                if !t.is_empty() {
                                                    yield t.to_string();
                                                }
                                            }
                                        }
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
