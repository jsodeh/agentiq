use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscalationCondition {
    pub metric: String,
    pub operator: String,
    pub threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscalationRule {
    pub id: String,
    pub name: String,
    pub condition: EscalationCondition,
    pub action: String,
}

pub struct EscalationEngine;

impl EscalationEngine {
    pub fn evaluate_rule(rule: &EscalationRule, current_value: f64) -> bool {
        match rule.condition.operator.as_str() {
            "gt" | ">" => current_value > rule.condition.threshold,
            "gte" | ">=" => current_value >= rule.condition.threshold,
            "lt" | "<" => current_value < rule.condition.threshold,
            "lte" | "<=" => current_value <= rule.condition.threshold,
            "eq" | "==" => (current_value - rule.condition.threshold).abs() < f64::EPSILON,
            _ => false,
        }
    }
}
