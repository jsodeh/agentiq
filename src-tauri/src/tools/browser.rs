use async_trait::async_trait;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tracing::{info, warn, error};

use super::ToolExecutor;
use crate::errors::AppError;

// ────────────────────────────────────────────────────────────────────────────
// Persistent Browser Session
// ────────────────────────────────────────────────────────────────────────────

/// A persistent browser session backed by a Node.js Playwright subprocess.
/// The subprocess runs an inline script that accepts JSON commands via stdin
/// and returns JSON results via stdout — enabling real DOM interactions.
struct BrowserSession {
    child: Child,
    stdin: tokio::process::ChildStdin,
    stdout: BufReader<tokio::process::ChildStdout>,
}

impl BrowserSession {
    async fn spawn(user_data_dir: &str) -> Result<Self, AppError> {
        info!("Spawning persistent Playwright browser session (user data: {})", user_data_dir);

        // Inline Node.js script that maintains a persistent Chromium context
        let script = format!(r#"
const {{ chromium }} = require('playwright');
const readline = require('readline');

(async () => {{
    const browser = await chromium.launchPersistentContext('{}', {{
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        viewport: {{ width: 1280, height: 720 }},
    }});
    const page = browser.pages()[0] || await browser.newPage();

    const rl = readline.createInterface({{ input: process.stdin }});

    rl.on('line', async (line) => {{
        try {{
            const cmd = JSON.parse(line);
            let result = {{}};

            switch (cmd.action) {{
                case 'navigate':
                    await page.goto(cmd.url, {{ waitUntil: 'domcontentloaded', timeout: 15000 }});
                    result = {{ status: 'success', url: page.url(), title: await page.title() }};
                    break;

                case 'click':
                    await page.click(cmd.selector, {{ timeout: 5000 }});
                    result = {{ status: 'success', action: 'click', selector: cmd.selector }};
                    break;

                case 'type':
                    await page.fill(cmd.selector, cmd.text, {{ timeout: 5000 }});
                    result = {{ status: 'success', action: 'type', selector: cmd.selector, text: cmd.text }};
                    break;

                case 'screenshot':
                    const path = cmd.path || '/tmp/agentiq_screenshot.png';
                    await page.screenshot({{ path, fullPage: false }});
                    result = {{ status: 'success', action: 'screenshot', path }};
                    break;

                case 'extract_text':
                    let text;
                    if (cmd.selector) {{
                        const el = await page.$(cmd.selector);
                        text = el ? await el.innerText() : '';
                    }} else {{
                        text = await page.innerText('body');
                    }}
                    // Truncate long text to prevent context overflow
                    if (text.length > 12000) text = text.substring(0, 12000) + '... [truncated]';
                    result = {{ status: 'success', action: 'extract_text', text }};
                    break;

                default:
                    result = {{ status: 'error', message: 'Unknown action: ' + cmd.action }};
            }}

            console.log(JSON.stringify(result));
        }} catch (err) {{
            console.log(JSON.stringify({{ status: 'error', message: err.message }}));
        }}
    }});

    rl.on('close', async () => {{
        await browser.close();
        process.exit(0);
    }});
}})();
"#, user_data_dir.replace('\\', "\\\\").replace('\'', "\\'"));

        let mut child = Command::new("node")
            .arg("-e")
            .arg(&script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| AppError::ToolExecution {
                tool: "browser".to_string(),
                message: format!(
                    "Failed to spawn Playwright session. Ensure Node.js and 'playwright' are installed: {}",
                    e
                ),
            })?;

        let stdin = child.stdin.take().ok_or_else(|| AppError::ToolExecution {
            tool: "browser".to_string(),
            message: "Failed to open stdin for Playwright session".into(),
        })?;

        let stdout = child.stdout.take().ok_or_else(|| AppError::ToolExecution {
            tool: "browser".to_string(),
            message: "Failed to open stdout for Playwright session".into(),
        })?;

        // Give the browser process a moment to initialize
        tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;

        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        })
    }

    async fn send_command(&mut self, cmd: Value) -> Result<Value, AppError> {
        let mut raw = serde_json::to_string(&cmd).map_err(|e| AppError::ToolExecution {
            tool: "browser".to_string(),
            message: format!("Failed to serialize browser command: {}", e),
        })?;
        raw.push('\n');

        self.stdin.write_all(raw.as_bytes()).await.map_err(|e| AppError::ToolExecution {
            tool: "browser".to_string(),
            message: format!("Failed to write to browser stdin: {}", e),
        })?;
        self.stdin.flush().await.map_err(|e| AppError::ToolExecution {
            tool: "browser".to_string(),
            message: format!("Failed to flush browser stdin: {}", e),
        })?;

        let mut line = String::new();
        let bytes_read = self.stdout.read_line(&mut line).await.map_err(|e| AppError::ToolExecution {
            tool: "browser".to_string(),
            message: format!("Failed to read from browser stdout: {}", e),
        })?;

        if bytes_read == 0 {
            return Err(AppError::ToolExecution {
                tool: "browser".to_string(),
                message: "Browser session closed stdout unexpectedly".into(),
            });
        }

        serde_json::from_str(&line).map_err(|e| AppError::ToolExecution {
            tool: "browser".to_string(),
            message: format!("Invalid JSON response from browser session: {} (raw: {})", e, line.trim()),
        })
    }
}

// ────────────────────────────────────────────────────────────────────────────
// BrowserTool — Persistent Playwright Process Manager
// ────────────────────────────────────────────────────────────────────────────

pub struct BrowserTool {
    session: Mutex<Option<BrowserSession>>,
    user_data_dir: String,
}

impl BrowserTool {
    pub fn new() -> Self {
        // Persistent browser user data directory for cookie/session persistence
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("agentiq")
            .join("browser_profile");

        Self {
            session: Mutex::new(None),
            user_data_dir: data_dir.to_string_lossy().to_string(),
        }
    }

    /// Ensure a persistent browser session is running. Spawns one if not.
    async fn ensure_session(&self) -> Result<(), AppError> {
        let mut guard = self.session.lock().await;
        if guard.is_none() {
            // Create the user data directory if it doesn't exist
            let _ = std::fs::create_dir_all(&self.user_data_dir);
            let session = BrowserSession::spawn(&self.user_data_dir).await?;
            *guard = Some(session);
        }
        Ok(())
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

    fn definitions(&self) -> Vec<crate::llm::ToolDefinition> {
        vec![
            crate::llm::ToolDefinition {
                name: "browser_navigate".to_string(),
                description: "Navigate the persistent browser to a URL. Returns the loaded page title and URL.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "url": { "type": "string", "description": "Target web URL to navigate to" }
                    },
                    "required": ["url"]
                }),
            },
            crate::llm::ToolDefinition {
                name: "browser_click".to_string(),
                description: "Click an interactive element on the current page using a CSS selector.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "selector": { "type": "string", "description": "CSS selector of element to click" }
                    },
                    "required": ["selector"]
                }),
            },
            crate::llm::ToolDefinition {
                name: "browser_type".to_string(),
                description: "Type text into an input field matching the specified CSS selector.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "selector": { "type": "string", "description": "CSS selector of target input" },
                        "text": { "type": "string", "description": "Text to type into the field" }
                    },
                    "required": ["selector", "text"]
                }),
            },
            crate::llm::ToolDefinition {
                name: "browser_screenshot".to_string(),
                description: "Capture a screenshot of the active browser viewport.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Optional file path to save screenshot" }
                    }
                }),
            },
            crate::llm::ToolDefinition {
                name: "browser_extract_text".to_string(),
                description: "Extract readable text content from the current page or a specific element via CSS selector.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "selector": { "type": "string", "description": "Optional CSS selector to scope text extraction" }
                    }
                }),
            },
        ]
    }

    async fn execute(&self, tool_name: &str, params: Value) -> Result<Value, AppError> {
        // Ensure the persistent Playwright session is alive
        if let Err(e) = self.ensure_session().await {
            warn!("Failed to start Playwright session, falling back to static mode: {}", e);
            // Graceful fallback: static npx playwright screenshot for navigate
            if tool_name == "browser_navigate" || tool_name == "playwright" {
                let url = params["url"].as_str().unwrap_or("https://example.com");
                let output = std::process::Command::new("npx")
                    .args(["playwright", "screenshot", url, "screenshot.png"])
                    .output();

                return match output {
                    Ok(out) => Ok(json!({
                        "status": if out.status.success() { "success" } else { "warning" },
                        "url": url,
                        "mode": "fallback_static",
                        "stdout": String::from_utf8_lossy(&out.stdout).to_string(),
                        "stderr": String::from_utf8_lossy(&out.stderr).to_string()
                    })),
                    Err(err) => Ok(json!({
                        "status": "error",
                        "url": url,
                        "mode": "fallback_static",
                        "message": format!("Playwright fallback failed: {}", err)
                    })),
                };
            }
            return Err(e);
        }

        let mut session_guard = self.session.lock().await;
        let session = session_guard.as_mut().ok_or_else(|| AppError::ToolExecution {
            tool: "browser".to_string(),
            message: "Browser session unexpectedly unavailable".into(),
        })?;

        let result = match tool_name {
            "browser_navigate" | "playwright" => {
                let url = params["url"].as_str().unwrap_or("https://example.com");
                session.send_command(json!({ "action": "navigate", "url": url })).await
            }
            "browser_click" => {
                let selector = params["selector"].as_str().ok_or_else(|| AppError::ToolExecution {
                    tool: "browser".to_string(),
                    message: "Missing 'selector' parameter for browser_click".into(),
                })?;
                session.send_command(json!({ "action": "click", "selector": selector })).await
            }
            "browser_type" => {
                let selector = params["selector"].as_str().ok_or_else(|| AppError::ToolExecution {
                    tool: "browser".to_string(),
                    message: "Missing 'selector' parameter for browser_type".into(),
                })?;
                let text = params["text"].as_str().ok_or_else(|| AppError::ToolExecution {
                    tool: "browser".to_string(),
                    message: "Missing 'text' parameter for browser_type".into(),
                })?;
                session.send_command(json!({ "action": "type", "selector": selector, "text": text })).await
            }
            "browser_screenshot" => {
                let path = params["path"].as_str().unwrap_or("/tmp/agentiq_screenshot.png");
                session.send_command(json!({ "action": "screenshot", "path": path })).await
            }
            "browser_extract_text" => {
                let selector = params["selector"].as_str();
                let mut cmd = json!({ "action": "extract_text" });
                if let Some(s) = selector {
                    cmd["selector"] = json!(s);
                }
                session.send_command(cmd).await
            }
            _ => Err(AppError::ToolExecution {
                tool: tool_name.to_string(),
                message: "Unsupported browser action".into(),
            }),
        };

        // If the session died mid-command, kill it so the next call re-spawns
        if result.is_err() {
            warn!("Browser session error detected — dropping session for re-spawn");
            *session_guard = None;
        }

        result
    }
}
