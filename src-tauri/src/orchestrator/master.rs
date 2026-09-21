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

        // 5. Response Instructions — always natural language
        prompt.push_str(
            "RESPONSE INSTRUCTIONS:\n\
            Always respond in clear, well-structured markdown. Never output raw JSON or code blocks as your final answer.\n\
            When tool results are provided in the conversation as TOOL_RESULT or SEARCH_RESULTS, use them as grounding facts \
            and synthesize a helpful, accurate, direct answer for the user."
        );

        prompt
    }

    /// Build a synthesis prompt for after tool execution — instructs LLM to summarize results.
    pub fn build_synthesis_system_prompt(
        pool: &DbPool,
        agent_registry: &Arc<AgentPluginRegistry>,
    ) -> String {
        let mut prompt = Self::build_hydrated_system_prompt(pool, agent_registry, "default");
        prompt.push_str(
            "\n\n---\n\nYou have just executed a live web search. \
            The results are included in the conversation. \
            Synthesize the search results into a concise, well-formatted markdown response. \
            Include key names, addresses, and relevant details where available. \
            Do not make up information not present in the results."
        );
        prompt
    }
}
