use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Instant;

use super::{FinishReason, LlmClient, LlmRequest, LlmResponse, TokenUsage};
use crate::errors::AppError;

pub struct GeminiClient {
    api_key: String,
    client: Client,
}

impl GeminiClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: Client::new(),
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

        if let Some(sys) = &request.system_prompt {
            contents.push(json!({
                "role": "user",
                "parts": [{"text": format!("System prompt: {}", sys)}]
            }));
            contents.push(json!({
                "role": "model",
                "parts": [{"text": "Understood."}]
            }));
        }

        for msg in &request.messages {
            let role = match msg.role.as_str() {
                "user" => "user",
                "assistant" | "model" => "model",
                _ => "user",
            };
            contents.push(json!({
                "role": role,
                "parts": [{"text": msg.content}]
            }));
        }

        let mut body = json!({
            "contents": contents,
        });

        if let Some(temp) = request.temperature {
            body["generationConfig"] = json!({
                "temperature": temp,
            });
        }

        // Only ya29. tokens are OAuth tokens; AQ. and AIza. are AI Studio API Keys
        let is_oauth = self.api_key.starts_with("ya29.");

        let url = if is_oauth {
            format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent", model)
        } else {
            format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, self.api_key
            )
        };

        let mut req_builder = self
            .client
            .post(&url)
            .header("content-type", "application/json");

        if is_oauth {
            req_builder = req_builder.header("authorization", format!("Bearer {}", self.api_key));
        } else {
            req_builder = req_builder.header("x-goog-api-key", &self.api_key);
        }

        let res = req_builder
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
                message: format!("Gemini API returned status {}: {}", status, err_text),
            });
        }

        let res_json: Value = res.json().await.map_err(|e| AppError::Llm {
            message: format!("Failed to parse Gemini JSON response: {}", e),
        })?;

        let duration = start.elapsed().as_millis() as u64;

        let mut text_content = String::new();
        if let Some(candidates) = res_json["candidates"].as_array() {
            if let Some(first) = candidates.first() {
                if let Some(parts) = first["content"]["parts"].as_array() {
                    for part in parts {
                        if let Some(t) = part["text"].as_str() {
                            text_content.push_str(t);
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

        Ok(LlmResponse {
            content: text_content,
            model,
            tokens_used: usage,
            finish_reason: FinishReason::Stop,
            tool_calls: Vec::new(),
            response_time_ms: duration,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::ChatMessage;

    #[tokio::test]
    async fn test_gemini_client_aq_key() {
        let key = match std::env::var("GEMINI_API_KEY") {
            Ok(k) if !k.is_empty() => k,
            _ => return,
        };
        let client = GeminiClient::new(key);
        let req = LlmRequest {
            model: "gemini-3.6-flash".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "Say 'hello'".to_string(),
            }],
            system_prompt: None,
            temperature: Some(0.1),
            max_tokens: Some(10),
            tools: None,
        };
        let res = client.generate(&req).await;
        assert!(res.is_ok(), "Gemini generate failed: {:?}", res.err());
        let response = res.unwrap();
        assert!(!response.content.is_empty());
    }
}

