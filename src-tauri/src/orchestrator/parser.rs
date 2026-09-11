use serde::{Deserialize, Serialize};
use serde_json::Value;

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
        let json_str = Self::extract_json(text)?;
        let plan: ExecutionPlan = serde_json::from_str(&json_str).map_err(|e| {
            AppError::Orchestrator(format!("Failed to parse execution plan JSON: {}", e))
        })?;
        Ok(plan)
    }

    fn extract_json(text: &str) -> Result<String, AppError> {
        let trimmed = text.trim();

        // 1. Try markdown ```json ... ```
        if let Some(start) = trimmed.find("```json") {
            let after_start = &trimmed[start + 7..];
            if let Some(end) = after_start.find("```") {
                return Ok(after_start[..end].trim().to_string());
            }
        }

        // 2. Try markdown ``` ... ```
        if let Some(start) = trimmed.find("```") {
            let after_start = &trimmed[start + 3..];
            if let Some(end) = after_start.find("```") {
                let inner = after_start[..end].trim();
                if inner.starts_with('{') && inner.ends_with('}') {
                    return Ok(inner.to_string());
                }
            }
        }

        // 3. Try finding raw JSON object { ... }
        if let (Some(first_brace), Some(last_brace)) = (trimmed.find('{'), trimmed.rfind('}')) {
            if first_brace < last_brace {
                return Ok(trimmed[first_brace..=last_brace].to_string());
            }
        }

        Err(AppError::Orchestrator(
            "No JSON content or code blocks found in model response".into(),
        ))
    }
}
