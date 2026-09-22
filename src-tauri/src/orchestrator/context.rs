use tracing::info;

pub struct ContextGuard;

impl ContextGuard {
    /// Distill or truncate raw tool outputs if they exceed max character thresholds.
    pub fn distill_tool_output(tool_name: &str, raw_output: &str, max_chars: usize) -> String {
        if raw_output.len() <= max_chars {
            return raw_output.to_string();
        }

        info!(
            "ContextGuard: Truncating large tool output for '{}' ({} chars > {} limit)",
            tool_name,
            raw_output.len(),
            max_chars
        );

        let truncated = &raw_output[..max_chars];
        format!(
            "{}\n\n... [Output truncated from {} to {} characters for context optimization]",
            truncated,
            raw_output.len(),
            max_chars
        )
    }
}
