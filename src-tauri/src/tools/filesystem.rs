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

    async fn execute(&self, tool_name: &str, params: Value) -> Result<Value, AppError> {
        match tool_name {
            "read_file" => {
                let path_str = params["path"]
                    .as_str()
                    .ok_or_else(|| AppError::ToolExecution {
                        tool: tool_name.to_string(),
                        message: "Missing 'path' parameter".into(),
                    })?;
                let content =
                    fs::read_to_string(path_str).map_err(|e| AppError::ToolExecution {
                        tool: tool_name.to_string(),
                        message: format!("Failed to read file '{}': {}", path_str, e),
                    })?;
                Ok(json!({ "path": path_str, "content": content }))
            }
            "write_file" => {
                let path_str = params["path"]
                    .as_str()
                    .ok_or_else(|| AppError::ToolExecution {
                        tool: tool_name.to_string(),
                        message: "Missing 'path' parameter".into(),
                    })?;
                let content = params["content"].as_str().unwrap_or("");
                let path = PathBuf::from(path_str);
                if let Some(parent) = path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                fs::write(&path, content).map_err(|e| AppError::ToolExecution {
                    tool: tool_name.to_string(),
                    message: format!("Failed to write file '{}': {}", path_str, e),
                })?;
                Ok(json!({ "path": path_str, "bytes_written": content.len() }))
            }
            "list_directory" => {
                let path_str = params["path"]
                    .as_str()
                    .ok_or_else(|| AppError::ToolExecution {
                        tool: tool_name.to_string(),
                        message: "Missing 'path' parameter".into(),
                    })?;
                let entries = fs::read_dir(path_str).map_err(|e| AppError::ToolExecution {
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
                let path_str = params["path"]
                    .as_str()
                    .ok_or_else(|| AppError::ToolExecution {
                        tool: tool_name.to_string(),
                        message: "Missing 'path' parameter".into(),
                    })?;
                fs::remove_file(path_str).map_err(|e| AppError::ToolExecution {
                    tool: tool_name.to_string(),
                    message: format!("Failed to delete file '{}': {}", path_str, e),
                })?;
                Ok(json!({ "path": path_str, "deleted": true }))
            }
            "create_directory" => {
                let path_str = params["path"]
                    .as_str()
                    .ok_or_else(|| AppError::ToolExecution {
                        tool: tool_name.to_string(),
                        message: "Missing 'path' parameter".into(),
                    })?;
                fs::create_dir_all(path_str).map_err(|e| AppError::ToolExecution {
                    tool: tool_name.to_string(),
                    message: format!("Failed to create directory '{}': {}", path_str, e),
                })?;
                Ok(json!({ "path": path_str, "created": true }))
            }
            "file_info" => {
                let path_str = params["path"]
                    .as_str()
                    .ok_or_else(|| AppError::ToolExecution {
                        tool: tool_name.to_string(),
                        message: "Missing 'path' parameter".into(),
                    })?;
                let metadata = fs::metadata(path_str).map_err(|e| AppError::ToolExecution {
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
