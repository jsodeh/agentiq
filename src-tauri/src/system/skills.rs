use std::sync::Arc;
use crate::agents::AgentPluginRegistry;
use crate::database::knowledge::KnowledgeQueries;
use crate::database::memory::MemoryQueries;
use crate::database::DbPool;

pub struct SkillsCatalog;

impl SkillsCatalog {
    pub fn build_catalog(
        pool: &DbPool,
        agent_registry: &Arc<AgentPluginRegistry>,
    ) -> String {
        let mut catalog = String::new();

        catalog.push_str("## BUILT-IN SYSTEM TOOLS & ENGINE CAPABILITIES\n");
        catalog.push_str("- web_search / google_search / exa_search: Search the web for real-time market data, news, and info (params: {\"query\": \"...\"})\n");
        catalog.push_str("- browser_open_url / scrapestack_extract_content: Scrape or open website content (params: {\"url\": \"...\"})\n");
        catalog.push_str("- google_maps_search: Find local businesses, addresses, and leads on Google Maps (params: {\"query\": \"...\"})\n");
        catalog.push_str("- read_file / write_file / list_directory: Perform local filesystem operations\n");
        catalog.push_str("- send_email: Send email communications via integrated providers\n");
        catalog.push_str("- rag_search_docs: Search internal vector/document knowledge base\n\n");

        catalog.push_str("## SPECIALIST SUB-AGENT ROSTER\n");
        let all_agents = agent_registry.all();
        if all_agents.is_empty() {
            catalog.push_str("- Assistant, Coder, Researcher, Lead Generator, Invoice Generator, Ad Maestro, Social Media Manager, WhatsApp Support, etc.\n");
        } else {
            for agent in all_agents {
                catalog.push_str(&format!(
                    "- **{}** (`{}`): {} [Tools: {}]\n",
                    agent.name,
                    agent.id,
                    agent.description,
                    agent.activated_tools.join(", ")
                ));
            }
        }
        catalog.push('\n');

        if let Ok(conn) = pool.get() {
            if let Ok(kb_items) = KnowledgeQueries::get_all_items(&conn) {
                if !kb_items.is_empty() {
                    catalog.push_str("## BUSINESS KNOWLEDGE BASE DOCUMENTS\n");
                    for item in kb_items.iter().take(10) {
                        let snippet = if item.content.len() > 150 {
                            format!("{}...", &item.content[..150])
                        } else {
                            item.content.clone()
                        };
                        catalog.push_str(&format!("- **{}** (Category: {}): {}\n", item.title, item.category, snippet));
                    }
                    catalog.push('\n');
                }
            }

            if let Ok(facts) = MemoryQueries::get_all_facts(&conn) {
                if !facts.is_empty() {
                    catalog.push_str("## SYSTEM SHARED MEMORY & USER PREFERENCES\n");
                    for fact in facts.iter().take(10) {
                        catalog.push_str(&format!("- **{}**: {}\n", fact.key, fact.value));
                    }
                    catalog.push('\n');
                }
            }
        }

        catalog
    }
}
