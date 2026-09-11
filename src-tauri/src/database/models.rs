use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub r#type: String,
    pub status: String,
    pub config: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub agent_id: i64,
    pub description: String,
    pub status: String,
    pub result: Option<String>,
    pub priority: Option<i32>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Log {
    pub id: i64,
    pub agent_id: i64,
    pub level: String,
    pub message: String,
    pub metadata: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Escalation {
    pub id: i64,
    pub task_id: i64,
    pub reason: String,
    pub status: String,
    pub created_at: String,
    pub resolved_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: i64,
    pub agent_id: i64,
    pub title: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: i64,
    pub conversation_id: i64,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserAction {
    pub id: String,
    pub session_id: String,
    pub agent_id: i64,
    pub action: String,
    pub selector: Option<String>,
    pub value: Option<String>,
    pub url: Option<String>,
    pub timestamp: i64,
    pub screenshot_path: Option<String>,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecording {
    pub id: String,
    pub session_id: String,
    pub agent_id: i64,
    pub file_path: String,
    pub file_size: i64,
    pub duration: i64,
    pub start_time: i64,
    pub end_time: i64,
    pub starred: bool,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalDecision {
    pub id: String,
    pub action_id: String,
    pub agent_id: i64,
    pub approved: bool,
    pub reason: Option<String>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationCapture {
    pub id: String,
    pub action_id: String,
    pub agent_id: i64,
    pub capture_path: String,
    pub timestamp: i64,
}
