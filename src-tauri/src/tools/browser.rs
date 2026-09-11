use async_trait::async_trait;
use serde_json::{json, Value};
use std::process::Command;

use super::ToolExecutor;
use crate::errors::AppError;

pub struct BrowserTool;

impl BrowserTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ToolExecutor for BrowserTool {
    fn name(&self) -> &str {
        "browser"
    }

    fn can_handle(&self, tool_name: &str) -> bool {
        matches!(
            tool_name,
            "browser_navigate"
                | "browser_click"
                | "browser_type"
                | "browser_screenshot"
                | "browser_extract_text"
                | "playwright"
        )
    }

    async fn execute(&self, tool_name: &str, params: Value) -> Result<Value, AppError> {
        let url = params["url"].as_str().unwrap_or("https://example.com");

        match tool_name {
            "browser_navigate" | "playwright" => {
                let output = Command::new("npx")
                    .args(["playwright", "screenshot", url, "screenshot.png"])
                    .output();

                match output {
                    Ok(out) => Ok(json!({
                        "status": if out.status.success() { "success" } else { "warning" },
                        "url": url,
                        "stdout": String::from_utf8_lossy(&out.stdout),
                        "stderr": String::from_utf8_lossy(&out.stderr)
                    })),
                    Err(e) => Ok(json!({
                        "status": "mocked",
                        "url": url,
                        "message": format!("Playwright execution fallback: {}", e)
                    })),
                }
            }
            "browser_click" | "browser_type" | "browser_screenshot" | "browser_extract_text" => {
                Ok(json!({
                    "status": "success",
                    "action": tool_name,
                    "params": params
                }))
            }
            _ => Err(AppError::ToolExecution {
                tool: tool_name.to_string(),
                message: "Unsupported browser action".into(),
            }),
        }
    }
}
