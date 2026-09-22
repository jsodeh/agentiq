use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::Mutex;
use serde::Serialize;
use tokio::sync::oneshot;
use tracing::{info, warn};

// ────────────────────────────────────────────────────────────────────────────
// ExecutionStatus — state machine for the agent runtime
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status")]
pub enum ExecutionStatus {
    Running,
    AwaitingApproval {
        approval_id: String,
        tool_name: String,
    },
    Completed,
    Failed {
        error: String,
    },
}

// ────────────────────────────────────────────────────────────────────────────
// SuspensionRegistry — thread-safe map of pending HITL approval channels
// ────────────────────────────────────────────────────────────────────────────

/// A global, thread-safe registry that maps `approval_id` → a `oneshot::Sender<bool>`.
///
/// When the runtime encounters a sensitive tool, it registers a channel here
/// and `.await`s the receiver. The Tauri frontend calls `respond_to_action_approval`
/// which looks up the sender and transmits `true` (approved) or `false` (denied),
/// unblocking the suspended runtime thread without freezing the main process.
#[derive(Clone)]
pub struct SuspensionRegistry {
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

impl SuspensionRegistry {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register a new approval channel and wait for the user's response.
    ///
    /// This suspends the calling async task until the frontend responds.
    pub async fn wait_for_approval(&self, approval_id: &str) -> bool {
        let (tx, rx) = oneshot::channel::<bool>();

        {
            let mut map = self.pending.lock();
            map.insert(approval_id.to_string(), tx);
        }

        info!("SuspensionRegistry: Waiting for approval '{}'", approval_id);

        // Await the frontend's decision — this suspends without blocking the OS thread
        match rx.await {
            Ok(approved) => {
                info!(
                    "SuspensionRegistry: Approval '{}' resolved: {}",
                    approval_id,
                    if approved { "APPROVED" } else { "DENIED" }
                );
                approved
            }
            Err(_) => {
                warn!(
                    "SuspensionRegistry: Approval '{}' channel dropped — defaulting to DENIED",
                    approval_id
                );
                false
            }
        }
    }

    /// Resolve a pending approval (called by the Tauri command handler).
    ///
    /// Returns `true` if the approval_id was found and the signal was sent.
    pub fn resolve(&self, approval_id: &str, approved: bool) -> bool {
        let mut map = self.pending.lock();
        if let Some(sender) = map.remove(approval_id) {
            match sender.send(approved) {
                Ok(()) => {
                    info!(
                        "SuspensionRegistry: Resolved '{}' with {}",
                        approval_id,
                        if approved { "APPROVED" } else { "DENIED" }
                    );
                    true
                }
                Err(_) => {
                    warn!(
                        "SuspensionRegistry: Receiver for '{}' already dropped",
                        approval_id
                    );
                    false
                }
            }
        } else {
            warn!(
                "SuspensionRegistry: No pending approval found for '{}'",
                approval_id
            );
            false
        }
    }

    /// Check how many approvals are currently pending.
    pub fn pending_count(&self) -> usize {
        self.pending.lock().len()
    }
}
