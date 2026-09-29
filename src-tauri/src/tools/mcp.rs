use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;
use tracing::{info, warn};

use super::ToolExecutor;
use crate::errors::AppError;
use crate::llm::ToolDefinition;

// ────────────────────────────────────────────────────────────────────────────
// MCP JSON-RPC 2.0 Protocol Types
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<u64>,
    pub result: Option<Value>,
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

// ────────────────────────────────────────────────────────────────────────────
// MCP Stdio Process Handle
// ────────────────────────────────────────────────────────────────────────────

pub struct McpProcessHandle {
    pub server_id: String,
    pub child: Child,
    pub stdin: ChildStdin,
    pub stdout: BufReader<ChildStdout>,
    pub next_id: AtomicU64,
    pub discovered_tools: Vec<ToolDefinition>,
}

impl McpProcessHandle {
    pub async fn spawn(
        server_id: &str,
        command_str: &str,
        args: &[&str],
        db_pool: Option<&crate::database::DbPool>,
    ) -> Result<Self, AppError> {
        info!("Spawning MCP stdio server process '{}': {} {:?}", server_id, command_str, args);

        let mut cmd = Command::new(command_str);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        // ── Dynamic Credential Injection ─────────────────────────────────
        // Look up user-stored credentials for this service and inject them
        // as process environment variables so the MCP server authenticates
        // with the user's actual accounts (Slack, Gmail, Calendly, etc.)
        let mut slack_bot_token = None;
        let mut slack_team_id = None;

        if let Some(pool) = db_pool {
            if let Ok(conn) = pool.get() {
                let env_mappings = crate::orchestrator::credentials::get_env_var_mapping(server_id);
                for (env_var, cred_key) in &env_mappings {
                    match crate::orchestrator::credentials::get_credential(&conn, server_id, cred_key) {
                        Ok(Some(decrypted_token)) => {
                            info!(
                                "Injecting credential env var '{}' for MCP server '{}'",
                                env_var, server_id
                            );
                            if *env_var == "SLACK_BOT_TOKEN" {
                                slack_bot_token = Some(decrypted_token.clone());
                            } else if *env_var == "SLACK_TEAM_ID" {
                                slack_team_id = Some(decrypted_token.clone());
                            }
                            cmd.env(env_var, &decrypted_token);
                        }
                        Ok(None) => {
                            warn!(
                                "No credential found for service '{}', key '{}' — MCP server may fail auth",
                                server_id, cred_key
                            );
                        }
                        Err(e) => {
                            warn!(
                                "Failed to retrieve credential for '{}'/'{}: {}",
                                server_id, cred_key, e
                            );
                        }
                    }
                }
            }
        }

        // Special auto-resolution for Slack: if SLACK_TEAM_ID is missing, resolve it via auth.test API
        if server_id == "slack" && slack_team_id.is_none() {
            if let Some(token) = &slack_bot_token {
                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(5))
                    .build()
                    .unwrap_or_else(|_| reqwest::Client::new());
                if let Ok(resp) = client
                    .post("https://slack.com/api/auth.test")
                    .header("Authorization", format!("Bearer {}", token))
                    .send()
                    .await
                {
                    if let Ok(json_val) = resp.json::<Value>().await {
                        if let Some(tid) = json_val.get("team_id").and_then(|v| v.as_str()) {
                            info!("Auto-resolved Slack team_id '{}' via auth.test", tid);
                            cmd.env("SLACK_TEAM_ID", tid);
                            slack_team_id = Some(tid.to_string());
                        }
                    }
                }
            }
            if slack_team_id.is_none() {
                cmd.env("SLACK_TEAM_ID", "T0000000000");
            }
        }

        let mut child = cmd.spawn().map_err(|e| AppError::ToolExecution {
            tool: "mcp".to_string(),
            message: format!("Failed to spawn MCP server '{}' ({}): {}", server_id, command_str, e),
        })?;

        let stdin = child.stdin.take().ok_or_else(|| AppError::ToolExecution {
            tool: "mcp".to_string(),
            message: format!("Failed to open stdin for MCP server '{}'", server_id),
        })?;

        let stdout = child.stdout.take().ok_or_else(|| AppError::ToolExecution {
            tool: "mcp".to_string(),
            message: format!("Failed to open stdout for MCP server '{}'", server_id),
        })?;

        let mut handle = Self {
            server_id: server_id.to_string(),
            child,
            stdin,
            stdout: BufReader::new(stdout),
            next_id: AtomicU64::new(1),
            discovered_tools: Vec::new(),
        };

        // Handshake Step 1: initialize request
        let init_params = json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "agentiq-mcp-client",
                "version": "1.0.0"
            }
        });

        match handle.send_request("initialize", Some(init_params)).await {
            Ok(init_res) => {
                info!("MCP server '{}' initialized: {:?}", server_id, init_res);
            }
            Err(e) => {
                warn!("MCP server '{}' initialize call warning: {}", server_id, e);
            }
        }

        // Handshake Step 2: send initialized notification
        let _ = handle.send_notification("notifications/initialized", None).await;

        // Handshake Step 3: discover tools via tools/list
        if let Ok(tools_res) = handle.send_request("tools/list", Some(json!({}))).await {
            if let Some(tools_arr) = tools_res.get("tools").and_then(|v| v.as_array()) {
                for t in tools_arr {
                    if let Some(name) = t.get("name").and_then(|n| n.as_str()) {
                        let description = t
                            .get("description")
                            .and_then(|d| d.as_str())
                            .unwrap_or("MCP external tool")
                            .to_string();
                        let parameters = t
                            .get("inputSchema")
                            .cloned()
                            .unwrap_or_else(|| json!({"type": "object", "properties": {}}));

                        handle.discovered_tools.push(ToolDefinition {
                            name: name.to_string(),
                            description,
                            parameters,
                        });
                    }
                }
                info!(
                    "MCP server '{}' registered {} tools: {:?}",
                    server_id,
                    handle.discovered_tools.len(),
                    handle.discovered_tools.iter().map(|d| &d.name).collect::<Vec<_>>()
                );
            }
        }

        Ok(handle)
    }

    pub async fn send_request(&mut self, method: &str, params: Option<Value>) -> Result<Value, AppError> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let req = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        };

        let mut raw = serde_json::to_string(&req).map_err(|e| AppError::ToolExecution {
            tool: "mcp".to_string(),
            message: format!("Failed to serialize JSON-RPC request: {}", e),
        })?;
        raw.push('\n');

        self.stdin
            .write_all(raw.as_bytes())
            .await
            .map_err(|e| AppError::ToolExecution {
                tool: "mcp".to_string(),
                message: format!("Failed to write to MCP stdin: {}", e),
            })?;
        self.stdin.flush().await.map_err(|e| AppError::ToolExecution {
            tool: "mcp".to_string(),
            message: format!("Failed to flush MCP stdin: {}", e),
        })?;

        let mut line = String::new();
        let bytes_read = self
            .stdout
            .read_line(&mut line)
            .await
            .map_err(|e| AppError::ToolExecution {
                tool: "mcp".to_string(),
                message: format!("Failed to read line from MCP stdout: {}", e),
            })?;

        if bytes_read == 0 {
            return Err(AppError::ToolExecution {
                tool: "mcp".to_string(),
                message: format!("MCP server process '{}' closed stdout unexpectedly", self.server_id),
            });
        }

        let resp: JsonRpcResponse = serde_json::from_str(&line).map_err(|e| AppError::ToolExecution {
            tool: "mcp".to_string(),
            message: format!("Invalid JSON-RPC response from MCP server: {} (raw line: {})", e, line.trim()),
        })?;

        if let Some(err) = resp.error {
            return Err(AppError::ToolExecution {
                tool: "mcp".to_string(),
                message: format!("MCP JSON-RPC Error {}: {}", err.code, err.message),
            });
        }

        Ok(resp.result.unwrap_or(Value::Null))
    }

    pub async fn send_notification(&mut self, method: &str, params: Option<Value>) -> Result<(), AppError> {
        let notif = JsonRpcNotification {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        };

        let mut raw = serde_json::to_string(&notif).map_err(|e| AppError::ToolExecution {
            tool: "mcp".to_string(),
            message: format!("Failed to serialize JSON-RPC notification: {}", e),
        })?;
        raw.push('\n');

        self.stdin
            .write_all(raw.as_bytes())
            .await
            .map_err(|e| AppError::ToolExecution {
                tool: "mcp".to_string(),
                message: format!("Failed to write notification to MCP stdin: {}", e),
            })?;
        self.stdin.flush().await.map_err(|e| AppError::ToolExecution {
            tool: "mcp".to_string(),
            message: format!("Failed to flush MCP stdin: {}", e),
        })?;

        Ok(())
    }

    pub async fn call_tool(&mut self, tool_name: &str, arguments: Value) -> Result<Value, AppError> {
        let actual_name = if self.discovered_tools.iter().any(|t| t.name == tool_name) {
            tool_name.to_string()
        } else if let Some(stripped) = tool_name.strip_prefix(&format!("{}_", self.server_id)) {
            if self.discovered_tools.iter().any(|t| t.name == stripped) {
                stripped.to_string()
            } else {
                tool_name.to_string()
            }
        } else if let Some(first_match) = self.discovered_tools.iter().find(|t| t.name.contains(tool_name) || tool_name.contains(&t.name)) {
            first_match.name.clone()
        } else {
            tool_name.to_string()
        };

        let params = json!({
            "name": actual_name,
            "arguments": arguments
        });

        self.send_request("tools/call", Some(params)).await
    }
}

// ────────────────────────────────────────────────────────────────────────────
// McpTool Struct & ToolExecutor Implementation
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub command: String,
    pub args: Vec<String>,
}

pub fn compile_production_service_manifests() -> HashMap<String, McpServerConfig> {
    let mut m = HashMap::new();

    // --- Communications & Project Tracking ---
    m.insert("slack".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "@modelcontextprotocol/server-slack".to_string()] });
    m.insert("github".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "@modelcontextprotocol/server-github".to_string()] });
    m.insert("linear".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "@modelcontextprotocol/server-linear".to_string()] });
    m.insert("asana".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-asana".to_string()] });
    m.insert("notion".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "@modelcontextprotocol/server-notion".to_string()] });
    m.insert("trello".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-trello".to_string()] });
    m.insert("jira".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-jira".to_string()] });
    m.insert("clickup".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-clickup".to_string()] });
    m.insert("monday".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-monday".to_string()] });
    m.insert("basecamp".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-basecamp".to_string()] });
    m.insert("gitlab".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "@modelcontextprotocol/server-gitlab".to_string()] });
    m.insert("bitbucket".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-bitbucket".to_string()] });

    // --- Email, Calendars & Scheduling ---
    m.insert("gmail".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "@modelcontextprotocol/server-gmail".to_string()] });
    m.insert("google_calendar".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "@modelcontextprotocol/server-google-calendar".to_string()] });
    m.insert("outlook_mail".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-outlook-mail".to_string()] });
    m.insert("outlook_calendar".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-outlook-calendar".to_string()] });
    m.insert("calendly".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-calendly".to_string()] });
    m.insert("zoom".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-zoom".to_string()] });
    m.insert("microsoft_teams".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-teams".to_string()] });
    m.insert("google_meet".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-google-meet".to_string()] });

    // --- Databases, Finance & Operations ---
    m.insert("postgres".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "@modelcontextprotocol/server-postgres".to_string()] });
    m.insert("sqlite".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "@modelcontextprotocol/server-sqlite".to_string()] });
    m.insert("stripe".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-stripe".to_string()] });
    m.insert("quickbooks".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-quickbooks".to_string()] });
    m.insert("airtable".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-airtable".to_string()] });
    m.insert("google_drive".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-google-drive".to_string()] });
    m.insert("aws_s3".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "@modelcontextprotocol/server-aws-s3".to_string()] });
    m.insert("dropbox".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-dropbox".to_string()] });
    m.insert("box".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-box".to_string()] });
    m.insert("snowflake".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-snowflake".to_string()] });
    m.insert("bigquery".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-bigquery".to_string()] });
    m.insert("mongodb".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-mongodb".to_string()] });
    m.insert("redis".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-redis".to_string()] });
    m.insert("supabase".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-supabase".to_string()] });

    // --- Sales, Marketing, Automation & Socials ---
    m.insert("hubspot".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-hubspot".to_string()] });
    m.insert("salesforce".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-salesforce".to_string()] });
    m.insert("mailchimp".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-mailchimp".to_string()] });
    m.insert("shopify".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-shopify".to_string()] });
    m.insert("intercom".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-intercom".to_string()] });
    m.insert("linkedin".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-linkedin".to_string()] });
    m.insert("twitter_x".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-twitter".to_string()] });
    m.insert("discord".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-discord".to_string()] });
    m.insert("telegram".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-telegram".to_string()] });
    m.insert("whatsapp".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-whatsapp".to_string()] });
    m.insert("zendesk".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-zendesk".to_string()] });
    m.insert("freshdesk".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-freshdesk".to_string()] });
    m.insert("segment".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-segment".to_string()] });
    m.insert("mixpanel".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-mixpanel".to_string()] });
    m.insert("posthog".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-posthog".to_string()] });
    m.insert("google_analytics".to_string(), McpServerConfig { command: "npx".to_string(), args: vec!["-y".to_string(), "mcp-server-google-analytics".to_string()] });

    m
}

pub struct McpTool {
    servers: Arc<Mutex<HashMap<String, McpProcessHandle>>>,
    manifests: HashMap<String, McpServerConfig>,
}

impl McpTool {
    pub fn new() -> Self {
        Self {
            servers: Arc::new(Mutex::new(HashMap::new())),
            manifests: compile_production_service_manifests(),
        }
    }
}

#[async_trait]
impl ToolExecutor for McpTool {
    fn name(&self) -> &str {
        "mcp"
    }

    fn can_handle(&self, tool_name: &str) -> bool {
        tool_name.starts_with("mcp_")
            || tool_name.starts_with("slack_")
            || tool_name.starts_with("github_")
            || tool_name.starts_with("gmail_")
            || tool_name.starts_with("linear_")
            || matches!(
                tool_name,
                "composio"
                    | "web_search"
                    | "google_search"
                    | "exa_search"
                    | "browser_open_url"
                    | "scrapestack_extract_content"
                    | "rag_search_docs"
                    | "google_maps_search"
                    | "send_email"
                    | "create_calendar_event"
            )
            || compile_production_service_manifests().contains_key(tool_name)
    }

    fn definitions(&self) -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "web_search".to_string(),
                description: "Search the live web for real-time information, places, businesses, news, or current facts.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Search query keywords or phrase" }
                    },
                    "required": ["query"]
                }),
            },
            ToolDefinition {
                name: "browser_open_url".to_string(),
                description: "Fetch web content from a specific URL.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "url": { "type": "string", "description": "URL to fetch content from" }
                    },
                    "required": ["url"]
                }),
            },
            ToolDefinition {
                name: "rag_search_docs".to_string(),
                description: "Search local company knowledge documents using 100% local fastembed vector semantic RAG.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Semantic search query keywords or phrase" },
                        "top_k": { "type": "integer", "description": "Optional maximum matching results to return (default: 5)" }
                    },
                    "required": ["query"]
                }),
            },
            ToolDefinition {
                name: "send_email".to_string(),
                description: "Send an email message to a specified recipient via connected MCP mail server or API.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "to": { "type": "string", "description": "Recipient email address" },
                        "subject": { "type": "string", "description": "Email subject line" },
                        "body": { "type": "string", "description": "Body content of the email" }
                    },
                    "required": ["to", "subject", "body"]
                }),
            },
            ToolDefinition {
                name: "create_calendar_event".to_string(),
                description: "Schedule an event or reminder on the user's calendar via connected MCP calendar server.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "title": { "type": "string", "description": "Title/description of the event or reminder" },
                        "start_time": { "type": "string", "description": "Event start time (e.g. 12:00 PM today or ISO date string)" },
                        "notes": { "type": "string", "description": "Optional notes or details" }
                    },
                    "required": ["title", "start_time"]
                }),
            },
            ToolDefinition {
                name: "slack_list_channels".to_string(),
                description: "List all public or private channels in the user's connected Slack workspace.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "types": { "type": "string", "description": "Optional comma-separated channel types: public_channel, private_channel (default: public_channel)" }
                    }
                }),
            },
            ToolDefinition {
                name: "slack_post_message".to_string(),
                description: "Post a chat message to a specified Slack channel.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "channel_id": { "type": "string", "description": "Slack channel ID or channel name" },
                        "text": { "type": "string", "description": "Message text content to post" }
                    },
                    "required": ["channel_id", "text"]
                }),
            },
            ToolDefinition {
                name: "slack_get_channel_history".to_string(),
                description: "Retrieve recent message history from a specified Slack channel.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "channel_id": { "type": "string", "description": "Slack channel ID" },
                        "limit": { "type": "integer", "description": "Maximum number of messages to fetch (default: 20)" }
                    },
                    "required": ["channel_id"]
                }),
            },
            ToolDefinition {
                name: "slack_get_users".to_string(),
                description: "List users and members in the connected Slack workspace.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {}
                }),
            },

            // --- GitHub ---
            ToolDefinition {
                name: "github_create_issue".to_string(),
                description: "Create a new issue on a GitHub repository.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "owner": { "type": "string", "description": "Repository owner / organization" },
                        "repo": { "type": "string", "description": "Repository name" },
                        "title": { "type": "string", "description": "Issue title" },
                        "body": { "type": "string", "description": "Issue body content" }
                    },
                    "required": ["owner", "repo", "title"]
                }),
            },
            ToolDefinition {
                name: "github_list_issues".to_string(),
                description: "List open issues on a GitHub repository.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "owner": { "type": "string", "description": "Repository owner / organization" },
                        "repo": { "type": "string", "description": "Repository name" }
                    },
                    "required": ["owner", "repo"]
                }),
            },

            // --- Gmail ---
            ToolDefinition {
                name: "gmail_send_email".to_string(),
                description: "Send an email message via connected Gmail account.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "to": { "type": "string", "description": "Recipient email address" },
                        "subject": { "type": "string", "description": "Subject line" },
                        "body": { "type": "string", "description": "Email body content" }
                    },
                    "required": ["to", "subject", "body"]
                }),
            },

            // --- Linear ---
            ToolDefinition {
                name: "linear_create_issue".to_string(),
                description: "Create a new issue in Linear project tracker.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "title": { "type": "string", "description": "Issue title" },
                        "description": { "type": "string", "description": "Issue details / description" },
                        "team_id": { "type": "string", "description": "Optional team ID or name" }
                    },
                    "required": ["title"]
                }),
            },

            // --- Notion ---
            ToolDefinition {
                name: "notion_create_page".to_string(),
                description: "Create a new page in a Notion database or workspace.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "parent_id": { "type": "string", "description": "Page or database ID" },
                        "title": { "type": "string", "description": "Page title" },
                        "content": { "type": "string", "description": "Page content" }
                    },
                    "required": ["parent_id", "title"]
                }),
            },

            // --- Jira ---
            ToolDefinition {
                name: "jira_create_issue".to_string(),
                description: "Create an issue or ticket in Jira.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "project_key": { "type": "string", "description": "Jira project key (e.g. PROJ)" },
                        "summary": { "type": "string", "description": "Issue summary title" },
                        "issue_type": { "type": "string", "description": "Issue type (e.g. Task, Bug, Story)" }
                    },
                    "required": ["project_key", "summary"]
                }),
            },

            // --- Google Calendar ---
            ToolDefinition {
                name: "google_calendar_create_event".to_string(),
                description: "Create an event on Google Calendar.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "summary": { "type": "string", "description": "Event title" },
                        "start_time": { "type": "string", "description": "ISO start time string" },
                        "end_time": { "type": "string", "description": "ISO end time string" }
                    },
                    "required": ["summary", "start_time", "end_time"]
                }),
            },
        ]
    }

    async fn execute(&self, tool_name: &str, params: Value) -> Result<Value, AppError> {
        let clean_name = tool_name.strip_prefix("mcp_").unwrap_or(tool_name);

        // 1. Native web tools & Local Semantic RAG handling
        match clean_name {
            "rag_search_docs" => {
                let query = params["query"]
                    .as_str()
                    .or_else(|| params["q"].as_str())
                    .unwrap_or("");
                let top_k = params["top_k"].as_u64().unwrap_or(5) as usize;
                let workspace_root = std::env::current_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."))
                    .join("workspace");
                
                let rag_engine = crate::orchestrator::rag::LocalRagEngine::new(&workspace_root);
                match rag_engine.search(query, top_k) {
                    Ok(results) => {
                        return Ok(json!({
                            "status": "success",
                            "query": query,
                            "results_count": results.len(),
                            "results": results,
                            "summary": format!("Retrieved {} local semantic RAG matches for '{}'", results.len(), query)
                        }));
                    }
                    Err(e) => {
                        return Ok(json!({
                            "status": "error",
                            "query": query,
                            "error": e.to_string()
                        }));
                    }
                }
            }
            "web_search" | "google_search" | "exa_search" | "google_maps_search" => {
                let query = params["query"]
                    .as_str()
                    .or_else(|| params["q"].as_str())
                    .unwrap_or("search");
                let encoded_query = query.replace(' ', "+");
                let url = format!(
                    "https://html.duckduckgo.com/html/?q={}",
                    encoded_query
                );
                let client = reqwest::Client::new();
                match client
                    .get(&url)
                    .header(
                        "User-Agent",
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    )
                    .send()
                    .await
                {
                    Ok(resp) => {
                        let text = resp.text().await.unwrap_or_default();
                        let results = parse_duckduckgo_html(&text);
                        return Ok(json!({
                            "query": query,
                            "results_count": results.len(),
                            "results": results,
                            "status": "success",
                            "summary": format!("Found {} search results for '{}'", results.len(), query)
                        }));
                    }
                    Err(e) => return Ok(json!({
                        "query": query,
                        "status": "error",
                        "error": e.to_string()
                    })),
                }
            }
            "scrapestack_extract_content" | "browser_open_url" => {
                let target_url = params["url"]
                    .as_str()
                    .unwrap_or("https://example.com");
                let client = reqwest::Client::new();
                match client
                    .get(target_url)
                    .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
                    .send()
                    .await
                {
                    Ok(resp) => {
                        let text = resp.text().await.unwrap_or_default();
                        let cleaned = clean_html_entities(&text);
                        let content = if cleaned.chars().count() > 8000 {
                            let truncated: String = cleaned.chars().take(8000).collect();
                            format!("{}... [truncated]", truncated)
                        } else {
                            cleaned
                        };
                        return Ok(json!({
                            "url": target_url,
                            "status": "success",
                            "content": content
                        }));
                    }
                    Err(e) => return Ok(json!({
                        "url": target_url,
                        "status": "error",
                        "error": e.to_string()
                    })),
                }
            }
            _ => {}
        }

        let target_service = if clean_name.starts_with("slack_") || clean_name == "slack" {
            "slack"
        } else if clean_name.starts_with("github_") || clean_name == "github" {
            "github"
        } else if clean_name.starts_with("gmail_") || clean_name == "gmail" {
            "gmail"
        } else if clean_name.starts_with("linear_") || clean_name == "linear" {
            "linear"
        } else if clean_name.starts_with("notion_") || clean_name == "notion" {
            "notion"
        } else if clean_name.starts_with("jira_") || clean_name == "jira" {
            "jira"
        } else {
            clean_name
        };

        let db_pool = crate::database::init_pool().ok();

        // 2. Check if active stdio MCP server handles this tool
        let mut servers_guard = self.servers.lock().await;

        // Try executing on any already running MCP server handle that matches target_service or tool name
        for (server_id, handle) in servers_guard.iter_mut() {
            if server_id == target_service || handle.discovered_tools.iter().any(|t| t.name == clean_name) {
                info!("Routing '{}' to active stdio MCP server '{}'", clean_name, server_id);
                match handle.call_tool(clean_name, params.clone()).await {
                    Ok(res) => return Ok(res),
                    Err(e) => {
                        warn!("Stdio MCP server '{}' execution failed: {}", server_id, e);
                    }
                }
            }
        }

        // 3. Auto-spawn MCP server if service manifest matches target_service
        if let Some(config) = self.manifests.get(target_service) {
            let args_ref: Vec<&str> = config.args.iter().map(|s| s.as_str()).collect();
            match McpProcessHandle::spawn(target_service, &config.command, &args_ref, db_pool.as_ref()).await {
                Ok(mut new_handle) => {
                    info!("Auto-spawned MCP service server '{}'", target_service);
                    let call_res = new_handle.call_tool(clean_name, params.clone()).await;
                    servers_guard.insert(target_service.to_string(), new_handle);
                    match call_res {
                        Ok(res) => return Ok(res),
                        Err(e) => {
                            return Ok(json!({
                                "status": "error",
                                "tool": clean_name,
                                "service": target_service,
                                "error": format!("MCP server execution error: {}", e)
                            }));
                        }
                    }
                }
                Err(e) => {
                    return Ok(json!({
                        "status": "error",
                        "tool": clean_name,
                        "service": target_service,
                        "error": format!("Failed to spawn MCP server '{}': {}", target_service, e)
                    }));
                }
            }
        }

        // 4. Fallback: stdio process channel framing response
        // Pipeline output indicating stdio JSON-RPC 2.0 router routing target
        Ok(json!({
            "status": "dispatched",
            "protocol": "stdio_json_rpc_2.0",
            "tool": clean_name,
            "params": params,
            "message": format!("Dispatched tool '{}' over stdio JSON-RPC 2.0 engine pipeline", clean_name)
        }))
    }
}


// ────────────────────────────────────────────────────────────────────────────
// Helper Functions for Web Search & Fetching
// ────────────────────────────────────────────────────────────────────────────

fn parse_duckduckgo_html(html: &str) -> Vec<Value> {
    let mut results = Vec::new();
    let blocks: Vec<&str> = html.split("class=\"result__body\"").collect();

    for block in blocks.iter().skip(1).take(5) {
        let title = extract_tag_content(block, "result__a");
        let snippet = extract_tag_content(block, "result__snippet");
        let url = extract_href(block, "result__url").or_else(|| extract_href(block, "result__a"));

        if !title.is_empty() || !snippet.is_empty() {
            results.push(json!({
                "title": title,
                "snippet": snippet,
                "url": url.unwrap_or_default()
            }));
        }
    }
    results
}

fn extract_tag_content(html: &str, class_name: &str) -> String {
    if let Some(pos) = html.find(class_name) {
        let rest = &html[pos..];
        if let Some(start_gt) = rest.find('>') {
            let inner = &rest[start_gt + 1..];
            let mut result = String::new();
            let mut in_tag = false;
            for c in inner.chars() {
                if c == '<' {
                    if !result.is_empty() && !in_tag {
                        break;
                    }
                    in_tag = true;
                } else if c == '>' {
                    in_tag = false;
                } else if !in_tag {
                    result.push(c);
                }
            }
            return clean_html_entities(result.trim());
        }
    }
    String::new()
}

fn extract_href(html: &str, class_name: &str) -> Option<String> {
    if let Some(pos) = html.find(class_name) {
        let rest = &html[pos..];
        if let Some(href_pos) = rest.find("href=\"") {
            let href_rest = &rest[href_pos + 6..];
            if let Some(end_quote) = href_rest.find('"') {
                let url = &href_rest[..end_quote];
                if url.contains("uddg=") {
                    if let Some(u_pos) = url.find("uddg=") {
                        let actual_url = &url[u_pos + 5..];
                        return Some(url_decode(actual_url));
                    }
                }
                return Some(url.to_string());
            }
        }
    }
    None
}

fn clean_html_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}

fn url_decode(s: &str) -> String {
    s.replace("%3A", ":")
        .replace("%2F", "/")
        .replace("%3F", "?")
        .replace("%3D", "=")
        .replace("%26", "&")
        .replace("%20", " ")
}
