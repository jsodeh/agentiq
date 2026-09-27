use serde::{Deserialize, Serialize};
use tracing::info;

use crate::errors::AppError;

// ────────────────────────────────────────────────────────────────────────────
// Tier Definitions
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UserTier {
    Free,
    Paid,
}

impl Default for UserTier {
    fn default() -> Self {
        UserTier::Free
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Premium-Only Tool Restriction List
// ────────────────────────────────────────────────────────────────────────────

/// Tools that are exclusively available on the Paid tier.
/// Free-tier users will be blocked with UPGRADE_REQUIRED when invoking these.
const PREMIUM_ONLY_TOOLS: &[&str] = &[
    // High-impact automation
    "playwright",
    "browser_click",
    "browser_type",
    "browser_extract_text",
    // Destructive filesystem actions
    "write_file",
    "delete_file",
    // Social / ads integrations
    "facebook_ads_create_campaign",
    "facebook_ads_update_budget",
    "facebook_ads_get_analytics",
    // Slack destructive actions
    "mcp_slack_delete_message",
    "mcp_slack_post_message",
    "mcp_slack_update_message",
    // Email & calendar write operations
    "send_email",
    "create_calendar_event",
    // Financial tools
    "payment_send",
    "invoice_generate",
    // Sub-agent orchestration
    "delegate_to_agent",
];

/// Glob-style prefix patterns that gate entire MCP tool families.
const PREMIUM_TOOL_PREFIXES: &[&str] = &[
    "facebook_ads_",
    "mcp_slack_",
    "mcp_gmail_send",
    "mcp_calendly_",
];

// ────────────────────────────────────────────────────────────────────────────
// Entitlement Guard
// ────────────────────────────────────────────────────────────────────────────

pub struct EntitlementGuard {
    pub current_tier: UserTier,
}

impl EntitlementGuard {
    pub fn new(tier: UserTier) -> Self {
        Self { current_tier: tier }
    }

    /// Check whether a given tool name is allowed under the current tier.
    /// Returns `Ok(())` if allowed, or an `AppError::ToolExecution` with
    /// the `UPGRADE_REQUIRED` prefix if blocked.
    pub fn check_tool_access(&self, tool_name: &str) -> Result<(), AppError> {
        if self.current_tier == UserTier::Paid {
            return Ok(());
        }

        // Exact-match check
        if PREMIUM_ONLY_TOOLS.iter().any(|&t| t == tool_name) {
            info!(
                "EntitlementGuard: Blocking free-tier access to premium tool '{}'",
                tool_name
            );
            return Err(AppError::ToolExecution {
                tool: tool_name.to_string(),
                message: format!(
                    "UPGRADE_REQUIRED: The tool '{}' is locked behind the Premium Tier. \
                     Upgrade your plan to unlock high-impact automation, browser control, \
                     email/calendar write access, and advanced integrations.",
                    tool_name
                ),
            });
        }

        // Prefix-match check for entire tool families
        if PREMIUM_TOOL_PREFIXES.iter().any(|&prefix| tool_name.starts_with(prefix)) {
            info!(
                "EntitlementGuard: Blocking free-tier access to premium tool family for '{}'",
                tool_name
            );
            return Err(AppError::ToolExecution {
                tool: tool_name.to_string(),
                message: format!(
                    "UPGRADE_REQUIRED: This action ('{}') is locked behind the Premium Tier. \
                     Upgrade to access full integration capabilities.",
                    tool_name
                ),
            });
        }

        Ok(())
    }

    /// Returns true if the tool is premium-only (useful for UI display).
    pub fn is_premium_tool(tool_name: &str) -> bool {
        PREMIUM_ONLY_TOOLS.iter().any(|&t| t == tool_name)
            || PREMIUM_TOOL_PREFIXES.iter().any(|&prefix| tool_name.starts_with(prefix))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_tier_blocks_premium_tools() {
        let guard = EntitlementGuard::new(UserTier::Free);
        assert!(guard.check_tool_access("playwright").is_err());
        assert!(guard.check_tool_access("send_email").is_err());
        assert!(guard.check_tool_access("facebook_ads_create_campaign").is_err());
    }

    #[test]
    fn free_tier_allows_basic_tools() {
        let guard = EntitlementGuard::new(UserTier::Free);
        assert!(guard.check_tool_access("web_search").is_ok());
        assert!(guard.check_tool_access("read_file").is_ok());
        assert!(guard.check_tool_access("list_directory").is_ok());
    }

    #[test]
    fn paid_tier_allows_everything() {
        let guard = EntitlementGuard::new(UserTier::Paid);
        assert!(guard.check_tool_access("playwright").is_ok());
        assert!(guard.check_tool_access("send_email").is_ok());
        assert!(guard.check_tool_access("delete_file").is_ok());
    }

    #[test]
    fn prefix_matching_blocks_tool_families() {
        let guard = EntitlementGuard::new(UserTier::Free);
        assert!(guard.check_tool_access("mcp_slack_post_message").is_err());
        assert!(guard.check_tool_access("mcp_calendly_create_event").is_err());
        assert!(guard.check_tool_access("facebook_ads_get_analytics").is_err());
    }
}
