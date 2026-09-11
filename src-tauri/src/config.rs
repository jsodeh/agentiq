use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tracing::info;
use crate::errors::Result;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionMode {
    Local,
    Cloud,
}

impl Default for ExecutionMode {
    fn default() -> Self {
        ExecutionMode::Local
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSettings {
    pub default_model: String,
    pub local_base_model: String,
    pub cloud_provider: String,
    pub cloud_model: String,
    pub anthropic_api_key: Option<String>,
    pub openai_api_key: Option<String>,
    pub gemini_api_key: Option<String>,
    pub custom_endpoint: Option<String>,
}

impl Default for ModelSettings {
    fn default() -> Self {
        Self {
            default_model: "llama3.2:3b".to_string(),
            local_base_model: "llama3.2:3b".to_string(),
            cloud_provider: "anthropic".to_string(),
            cloud_model: "claude-3-5-sonnet-20241022".to_string(),
            anthropic_api_key: None,
            openai_api_key: None,
            gemini_api_key: None,
            custom_endpoint: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub mode: ExecutionMode,
    pub models: ModelSettings,
    pub storage_dir: Option<PathBuf>,
}

impl AppConfig {
    pub fn get_config_dir() -> PathBuf {
        let home_dir = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home_dir).join(".agentiq")
    }

    pub fn get_config_path() -> PathBuf {
        Self::get_config_dir().join("config.toml")
    }

    pub fn load() -> Result<Self> {
        let config_path = Self::get_config_path();
        if !config_path.exists() {
            info!("Config file not found at {:?}, creating default", config_path);
            let config = AppConfig::default();
            config.save()?;
            return Ok(config);
        }

        let content = fs::read_to_string(&config_path)?;
        let mut config: AppConfig = toml::from_str(&content)?;

        // Normalize: treat empty strings as None for optional API key fields
        let m = &mut config.models;
        if m.anthropic_api_key.as_deref() == Some("") { m.anthropic_api_key = None; }
        if m.openai_api_key.as_deref() == Some("") { m.openai_api_key = None; }
        if m.gemini_api_key.as_deref() == Some("") { m.gemini_api_key = None; }
        if m.custom_endpoint.as_deref() == Some("") { m.custom_endpoint = None; }

        Ok(config)
    }

    pub fn save(&self) -> Result<()> {
        let config_dir = Self::get_config_dir();
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir)?;
        }

        let config_path = Self::get_config_path();
        let content = toml::to_string_pretty(self)?;
        fs::write(&config_path, content)?;
        info!("Saved configuration to {:?}", config_path);
        Ok(())
    }

    pub fn active_model(&self) -> &str {
        match self.mode {
            ExecutionMode::Local => &self.models.local_base_model,
            ExecutionMode::Cloud => &self.models.cloud_model,
        }
    }
}
