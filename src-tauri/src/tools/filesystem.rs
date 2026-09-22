use async_trait::async_trait;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

use super::ToolExecutor;
use crate::errors::AppError;

pub struct FilesystemTool;

impl FilesystemTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ToolExecutor for FilesystemTool {
    fn name(&self) -> &str {
        "filesystem"
    }

    fn can_handle(&self, tool_name: &str) -> bool {
        matches!(
            tool_name,
            "read_file"
                | "write_file"
                | "list_directory"
                | "delete_file"
                | "file_info"
                | "create_directory"
        )
    }

    fn definitions(&self) -> Vec<crate::llm::ToolDefinition> {
        vec![
            crate::llm::ToolDefinition {
                name: "read_file".to_string(),
                description: "Read the full text content of a file at the specified path.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute or relative file path to read" }
                    },
                    "required": ["path"]
                }),
            },
            crate::llm::ToolDefinition {
                name: "write_file".to_string(),
                description: "Write content to a file at the specified path (creates parent directories if needed).".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Target file path" },
                        "content": { "type": "string", "description": "Content to write to the file" }
                    },
                    "required": ["path", "content"]
                }),
            },
            crate::llm::ToolDefinition {
                name: "list_directory".to_string(),
                description: "List directory contents including filenames and subdirectories.".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Directory path to inspect" }
                    },
                    "required": ["path"]
                }),
            },
        ]
    }

    async fn execute(&self, tool_name: &str, params: Value) -> Result<Value, AppError> {
        let path_str = params["path"].as_str().ok_or_else(|| AppError::ToolExecution {
            tool: tool_name.to_string(),
            message: "Missing 'path' parameter".into(),
        })?;

        let target_path = validate_sandboxed_path(path_str)?;

        match tool_name {
            "read_file" => {
                let content =
                    fs::read_to_string(&target_path).map_err(|e| AppError::ToolExecution {
                        tool: tool_name.to_string(),
                        message: format!("Failed to read file '{}': {}", path_str, e),
                    })?;
                Ok(json!({ "path": path_str, "content": content }))
            }
            "write_file" => {
                let content = params["content"].as_str().unwrap_or("");
                if let Some(parent) = target_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                fs::write(&target_path, content).map_err(|e| AppError::ToolExecution {
                    tool: tool_name.to_string(),
                    message: format!("Failed to write file '{}': {}", path_str, e),
                })?;
                Ok(json!({ "path": path_str, "bytes_written": content.len() }))
            }
            "list_directory" => {
                let entries = fs::read_dir(&target_path).map_err(|e| AppError::ToolExecution {
                    tool: tool_name.to_string(),
                    message: format!("Failed to list directory '{}': {}", path_str, e),
                })?;

                let mut items = Vec::new();
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                    items.push(json!({ "name": name, "is_directory": is_dir }));
                }

                Ok(json!({ "path": path_str, "items": items }))
            }
            "delete_file" => {
                fs::remove_file(&target_path).map_err(|e| AppError::ToolExecution {
                    tool: tool_name.to_string(),
                    message: format!("Failed to delete file '{}': {}", path_str, e),
                })?;
                Ok(json!({ "path": path_str, "deleted": true }))
            }
            "create_directory" => {
                fs::create_dir_all(&target_path).map_err(|e| AppError::ToolExecution {
                    tool: tool_name.to_string(),
                    message: format!("Failed to create directory '{}': {}", path_str, e),
                })?;
                Ok(json!({ "path": path_str, "created": true }))
            }
            "file_info" => {
                let metadata = fs::metadata(&target_path).map_err(|e| AppError::ToolExecution {
                    tool: tool_name.to_string(),
                    message: format!("Failed to get metadata for '{}': {}", path_str, e),
                })?;
                Ok(json!({
                    "path": path_str,
                    "size": metadata.len(),
                    "is_directory": metadata.is_dir(),
                    "is_file": metadata.is_file(),
                }))
            }
            _ => Err(AppError::ToolExecution {
                tool: tool_name.to_string(),
                message: "Unsupported filesystem action".into(),
            }),
        }
    }
}

fn validate_sandboxed_path(path_str: &str) -> Result<PathBuf, AppError> {
    let target = PathBuf::from(path_str);
    let base_workspace = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    let canonical = if target.exists() {
        fs::canonicalize(&target).unwrap_or_else(|_| target.clone())
    } else if target.is_relative() {
        base_workspace.join(&target)
    } else {
        target.clone()
    };

    let base_canonical = fs::canonicalize(&base_workspace).unwrap_or(base_workspace);

    if !canonical.starts_with(&base_canonical) {
        return Err(AppError::ToolExecution {
            tool: "filesystem".to_string(),
            message: format!("Access Denied: Path '{}' violates sandbox workspace boundary", path_str),
        });
    }
    Ok(canonical)
}
