use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{error, debug};

use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionItem {
    pub tool: String,
    pub params: Value,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionPlan {
    pub reasoning: String,
    pub expected_outcome: Option<String>,
    pub actions: Vec<ActionItem>,
}

pub struct ResponseParser;

impl ResponseParser {
    pub fn parse(text: &str) -> Result<ExecutionPlan, AppError> {
        debug!("ResponseParser: raw text len={} first_100={:?}", text.len(), &text.chars().take(100).collect::<String>());
        match Self::extract_json(text) {
            Ok(json_str) => {
                debug!("ResponseParser: extracted JSON={}", &json_str.chars().take(200).collect::<String>());
                serde_json::from_str::<ExecutionPlan>(&json_str).map_err(|e| {
                    error!("ResponseParser: JSON deserialization failed: {} | json={}", e, &json_str.chars().take(400).collect::<String>());
                    AppError::Orchestrator(format!("Failed to parse execution plan JSON: {}", e))
                })
            }
            Err(e) => {
                error!("ResponseParser: extract_json failed: {} | raw_text_snippet={:?}", e, &text.chars().take(300).collect::<String>());
                Err(e)
            }
        }
    }

    fn extract_json(text: &str) -> Result<String, AppError> {
        let trimmed = text.trim();

        // 1. Try markdown ```json ... ``` (Gemini often wraps in this)
        if let Some(fence_start) = trimmed.find("```json") {
            let after_fence = &trimmed[fence_start + 7..];
            // Skip optional newline right after ```json
            let content_start = if after_fence.starts_with('\n') {
                &after_fence[1..]
            } else if after_fence.starts_with("\r\n") {
                &after_fence[2..]
            } else {
                after_fence
            };
            // Find the LAST closing ``` to avoid matching inner content
            if let Some(fence_end) = content_start.rfind("```") {
                let inner = content_start[..fence_end].trim();
                if !inner.is_empty() {
                    return Ok(inner.to_string());
                }
            }
        }

        // 2. Try plain ``` ... ``` block containing JSON
        if let Some(fence_start) = trimmed.find("```") {
            let after_fence = &trimmed[fence_start + 3..];
            // Skip language tag on same line if any, then newline
            let content_start = if let Some(nl) = after_fence.find('\n') {
                &after_fence[nl + 1..]
            } else {
                after_fence
            };
            if let Some(fence_end) = content_start.rfind("```") {
                let inner = content_start[..fence_end].trim();
                if inner.starts_with('{') && inner.ends_with('}') {
                    return Ok(inner.to_string());
                }
            }
        }

        // 3. Extract raw JSON object { ... } — find outermost braces
        if let (Some(first_brace), Some(last_brace)) = (trimmed.find('{'), trimmed.rfind('}')) {
            if first_brace < last_brace {
                return Ok(trimmed[first_brace..=last_brace].to_string());
            }
        }

        Err(AppError::Orchestrator(
            "No JSON action plan found in model response".into(),
        ))
    }
}
