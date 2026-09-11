use parking_lot::Mutex;
use std::collections::VecDeque;
use std::sync::Arc;

use crate::database::models::Task;

#[derive(Debug, Clone)]
pub struct TaskQueueItem {
    pub task: Task,
    pub priority: u8,
}

#[derive(Clone)]
pub struct TaskQueue {
    high_priority: Arc<Mutex<VecDeque<Task>>>,
    normal_priority: Arc<Mutex<VecDeque<Task>>>,
    low_priority: Arc<Mutex<VecDeque<Task>>>,
}

impl TaskQueue {
    pub fn new() -> Self {
        Self {
            high_priority: Arc::new(Mutex::new(VecDeque::new())),
            normal_priority: Arc::new(Mutex::new(VecDeque::new())),
            low_priority: Arc::new(Mutex::new(VecDeque::new())),
        }
    }

    pub fn push(&self, task: Task, priority: &str) {
        match priority.to_lowercase().as_str() {
            "high" => self.high_priority.lock().push_back(task),
            "low" => self.low_priority.lock().push_back(task),
            _ => self.normal_priority.lock().push_back(task),
        }
    }

    pub fn pop(&self) -> Option<Task> {
        if let Some(t) = self.high_priority.lock().pop_front() {
            return Some(t);
        }
        if let Some(t) = self.normal_priority.lock().pop_front() {
            return Some(t);
        }
        self.low_priority.lock().pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.high_priority.lock().is_empty()
            && self.normal_priority.lock().is_empty()
            && self.low_priority.lock().is_empty()
    }

    pub fn len(&self) -> usize {
        self.high_priority.lock().len()
            + self.normal_priority.lock().len()
            + self.low_priority.lock().len()
    }
}
