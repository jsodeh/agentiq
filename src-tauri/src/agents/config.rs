use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tracing::info;
use crate::errors::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPluginConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub keywords: Vec<String>,
    pub activated_tools: Vec<String>,
    pub system_prompt: String,
    pub default_model: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct AgentPluginRegistry {
    plugins: HashMap<String, AgentPluginConfig>,
}

impl AgentPluginRegistry {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
        }
    }

    pub fn load_defaults(&mut self) {
        let default_plugins = vec![
            AgentPluginConfig {
                id: "lead-gen-maps".to_string(),
                name: "Maps Lead Generator".to_string(),
                description: "Finds and enriches business leads using Google Maps and web search".to_string(),
                keywords: vec!["lead".to_string(), "prospect".to_string(), "google maps".to_string(), "business contact".to_string()],
                activated_tools: vec!["Google Maps search".to_string(), "Contact enrichment".to_string()],
                system_prompt: "You are an expert lead generation agent.".to_string(),
                default_model: None,
            },
            AgentPluginConfig {
                id: "invoice-generator".to_string(),
                name: "Smart Invoice Generator".to_string(),
                description: "Automates invoice creation, payment tracking, and follow-ups".to_string(),
                keywords: vec!["invoice".to_string(), "payment".to_string(), "receipt".to_string(), "bill".to_string()],
                activated_tools: vec!["Invoice creation".to_string(), "Payment tracking".to_string()],
                system_prompt: "You are a precise financial invoicing assistant.".to_string(),
                default_model: None,
            },
            AgentPluginConfig {
                id: "social-media-manager".to_string(),
                name: "Social Media Buzzmaker".to_string(),
                description: "Manages content planning, scheduling, and multi-platform publishing".to_string(),
                keywords: vec!["social".to_string(), "instagram".to_string(), "linkedin".to_string(), "post".to_string(), "content calendar".to_string()],
                activated_tools: vec!["Content planning".to_string(), "Social publishing".to_string()],
                system_prompt: "You are a creative social media campaign manager.".to_string(),
                default_model: None,
            },
            AgentPluginConfig {
                id: "customer-support-whatsapp".to_string(),
                name: "WhatsApp Support Hero".to_string(),
                description: "Handles customer messaging, query resolution, and escalation".to_string(),
                keywords: vec!["support".to_string(), "customer".to_string(), "whatsapp".to_string(), "complaint".to_string()],
                activated_tools: vec!["Customer messaging".to_string(), "Knowledge response".to_string()],
                system_prompt: "You are an empathetic customer support agent.".to_string(),
                default_model: None,
            },
            AgentPluginConfig {
                id: "coder".to_string(),
                name: "Code Master".to_string(),
                description: "Writes, refactors, debugs, and audits software projects".to_string(),
                keywords: vec!["code".to_string(), "bug".to_string(), "website".to_string(), "app".to_string(), "software".to_string()],
                activated_tools: vec!["Code analysis".to_string(), "Development workspace".to_string()],
                system_prompt: "You are an expert senior software engineer.".to_string(),
                default_model: None,
            },
            AgentPluginConfig {
                id: "market-research-analyst".to_string(),
                name: "Market Research Analyst".to_string(),
                description: "Conducts web research and market intelligence synthesis".to_string(),
                keywords: vec!["research".to_string(), "competitor".to_string(), "market".to_string(), "analyse".to_string(), "analyze".to_string()],
                activated_tools: vec!["Web research".to_string(), "Insight analysis".to_string()],
                system_prompt: "You are a meticulous market research analyst.".to_string(),
                default_model: None,
            },
            AgentPluginConfig {
                id: "appointment-booker".to_string(),
                name: "Calendar Whiz".to_string(),
                description: "Schedules meetings and manages calendar conflicts".to_string(),
                keywords: vec!["meeting".to_string(), "calendar".to_string(), "appointment".to_string(), "schedule".to_string()],
                activated_tools: vec!["Calendar access".to_string(), "Scheduling".to_string()],
                system_prompt: "You are an efficient executive assistant for scheduling.".to_string(),
                default_model: None,
            },
            AgentPluginConfig {
                id: "inventory-checker".to_string(),
                name: "Stock Sentinel".to_string(),
                description: "Monitors inventory levels and generates reorder alerts".to_string(),
                keywords: vec!["stock".to_string(), "inventory".to_string(), "warehouse".to_string(), "supply".to_string()],
                activated_tools: vec!["Inventory monitoring".to_string(), "Reorder alerts".to_string()],
                system_prompt: "You are a precise supply chain sentinel.".to_string(),
                default_model: None,
            },
            AgentPluginConfig {
                id: "cold-outreach".to_string(),
                name: "Cold Outreach Pro".to_string(),
                description: "Drafts and tracks cold outreach email campaigns".to_string(),
                keywords: vec!["email".to_string(), "newsletter".to_string(), "outreach".to_string()],
                activated_tools: vec!["Email drafting".to_string(), "Lead follow-up".to_string()],
                system_prompt: "You are a persuasive cold outreach copywriter.".to_string(),
                default_model: None,
            },
            AgentPluginConfig {
                id: "project-manager-ai".to_string(),
                name: "Project Pilot".to_string(),
                description: "Plans project timelines, tasks, and team deliverables".to_string(),
                keywords: vec!["project".to_string(), "task".to_string(), "timeline".to_string(), "plan".to_string()],
                activated_tools: vec!["Task planning".to_string(), "Team coordination".to_string()],
                system_prompt: "You are an organized Agile project manager.".to_string(),
                default_model: None,
            },
        ];

        for plugin in default_plugins {
            self.plugins.insert(plugin.id.clone(), plugin);
        }
    }

    pub fn load_from_dir(&mut self, dir: &PathBuf) -> Result<()> {
        if !dir.exists() {
            fs::create_dir_all(dir)?;
            return Ok(());
        }

        let entries = fs::read_dir(dir)?;
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("toml") {
                let content = fs::read_to_string(&path)?;
                if let Ok(config) = toml::from_str::<AgentPluginConfig>(&content) {
                    info!("Loaded custom agent plugin: {}", config.id);
                    self.plugins.insert(config.id.clone(), config);
                }
            }
        }

        Ok(())
    }

    pub fn route_request(&self, request: &str) -> (String, String, Vec<String>) {
        let req_lower = request.to_lowercase();
        
        for plugin in self.plugins.values() {
            if plugin.keywords.iter().any(|kw| req_lower.contains(kw)) {
                return (plugin.id.clone(), plugin.name.clone(), plugin.activated_tools.clone());
            }
        }

        (
            "assistant".to_string(),
            "Executive Assistant".to_string(),
            vec!["Task orchestration".to_string(), "Approval safeguards".to_string()],
        )
    }

    pub fn get(&self, id: &str) -> Option<&AgentPluginConfig> {
        self.plugins.get(id)
    }

    pub fn all(&self) -> Vec<&AgentPluginConfig> {
        self.plugins.values().collect()
    }
}
