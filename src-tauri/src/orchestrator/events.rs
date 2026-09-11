use serde::Serialize;
use serde_json::Value;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum OrchestratorEvent {
    TaskStarted {
        task_id: i64,
        agent_id: i64,
        description: String,
    },
    AgentThinking {
        task_id: i64,
        agent_id: i64,
        reasoning: String,
        expected_outcome: Option<String>,
    },
    ActionStarted {
        task_id: i64,
        agent_id: i64,
        tool: String,
        params: Value,
        description: Option<String>,
    },
    ActionCompleted {
        task_id: i64,
        agent_id: i64,
        tool: String,
        result: Value,
        success: bool,
    },
    ActionFailed {
        task_id: i64,
        agent_id: i64,
        tool: String,
        error: String,
    },
    TaskCompleted {
        task_id: i64,
        agent_id: i64,
        result: Value,
    },
    TaskFailed {
        task_id: i64,
        agent_id: i64,
        error: String,
    },
    EscalationCreated {
        escalation_id: i64,
        task_id: i64,
        agent_id: i64,
        reason: String,
    },
}

pub struct EventBus {
    sender: broadcast::Sender<OrchestratorEvent>,
}

impl EventBus {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    pub fn publish(&self, event: OrchestratorEvent) {
        let _ = self.sender.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<OrchestratorEvent> {
        self.sender.subscribe()
    }
}
