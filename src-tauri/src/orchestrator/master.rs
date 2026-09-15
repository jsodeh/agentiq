use std::sync::Arc;
use crate::agents::AgentPluginRegistry;
use crate::database::DbPool;
use crate::system::{BEHAVIOUR_MD, SOUL_MD, skills::SkillsCatalog};

pub struct MasterOrchestrator;

impl MasterOrchestrator {
    pub fn build_hydrated_system_prompt(
        pool: &DbPool,
        agent_registry: &Arc<AgentPluginRegistry>,
        agent_type: &str,
    ) -> String {
        let mut prompt = String::new();

        // 1. Core Soul & Identity
        prompt.push_str(SOUL_MD);
        prompt.push_str("\n\n---\n\n");

        // 2. Behavioral Protocols
        prompt.push_str(BEHAVIOUR_MD);
        prompt.push_str("\n\n---\n\n");

        // 3. Dynamic Skills, Sub-Agent Catalog & Knowledge Base
        let catalog = SkillsCatalog::build_catalog(pool, agent_registry);
        prompt.push_str(&catalog);
        prompt.push_str("\n---\n\n");

        // 4. Active Sub-Agent Context (if specialized sub-agent is active)
        if let Some(plugin) = agent_registry.get(agent_type) {
            prompt.push_str(&format!(
                "## ACTIVE SUB-AGENT ROLE: {} (`{}`)\n{}\n\nSpecific Sub-Agent System Prompt:\n{}\n\n",
                plugin.name, plugin.id, plugin.description, plugin.system_prompt
            ));
        }

        // 5. Execution Instructions
        prompt.push_str(
            "INSTRUCTION FOR SYSTEM EXECUTION:\n\
            Analyze the user's intent carefully.\n\
            - If tools (web search, Google Maps search, browser scraping, filesystem, email, etc.) are needed to fulfill the request, output a structured JSON action plan in this format:\n\
            {\"reasoning\": \"...\", \"expected_outcome\": \"...\", \"actions\": [{\"tool\": \"web_search\", \"params\": {\"query\": \"...\"}, \"description\": \"...\"}]}\n\
            - If no tools are required, answer directly in natural, authoritative, and well-structured markdown text."
        );

        prompt
    }
}
