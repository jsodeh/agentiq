use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

use crate::errors::AppError;

// ────────────────────────────────────────────────────────────────────────────
// Credential Record
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserCredential {
    pub service_id: String,
    pub credential_key: String,
    pub token_value: String,
}

// ────────────────────────────────────────────────────────────────────────────
// XOR-based Local Encryption (Machine-Seed Obfuscation)
// ────────────────────────────────────────────────────────────────────────────
// NOTE: This is a lightweight obfuscation layer suitable for local desktop
// storage. For production SaaS deployments, replace with AES-256-GCM or
// an OS-native keychain integration (macOS Keychain / Windows DPAPI).

fn get_machine_seed() -> Vec<u8> {
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "agentiq-default-seed".to_string());

    let username = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "agentiq".to_string());

    let combined = format!("agentiq::{}::{}", hostname, username);
    // Derive a repeatable 32-byte key via simple hash expansion
    let mut key = Vec::with_capacity(32);
    let mut hash: u64 = 0xcbf29ce484222325; // FNV-1a offset basis
    for byte in combined.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3); // FNV-1a prime
    }
    for i in 0..32u8 {
        key.push(((hash >> (i % 8 * 8)) ^ (i as u64)) as u8);
    }
    key
}

fn xor_encrypt(plaintext: &str) -> String {
    let key = get_machine_seed();
    let encrypted: Vec<u8> = plaintext
        .as_bytes()
        .iter()
        .enumerate()
        .map(|(i, b)| b ^ key[i % key.len()])
        .collect();
    hex::encode(encrypted)
}

fn xor_decrypt(ciphertext: &str) -> Result<String, AppError> {
    let key = get_machine_seed();
    let encrypted_bytes = hex::decode(ciphertext).map_err(|e| AppError::Config(
        format!("Failed to decode credential hex: {}", e),
    ))?;
    let decrypted: Vec<u8> = encrypted_bytes
        .iter()
        .enumerate()
        .map(|(i, b)| b ^ key[i % key.len()])
        .collect();
    String::from_utf8(decrypted).map_err(|e| AppError::Config(
        format!("Failed to decode decrypted credential string: {}", e),
    ))
}

// ────────────────────────────────────────────────────────────────────────────
// Database Schema Migration
// ────────────────────────────────────────────────────────────────────────────

pub fn migrate_credentials_table(conn: &Connection) -> crate::errors::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_id TEXT NOT NULL,
            credential_key TEXT NOT NULL,
            token_value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(service_id, credential_key)
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_credentials_service ON user_credentials(service_id)",
        [],
    )?;

    info!("Credential table migration complete");
    Ok(())
}

// ────────────────────────────────────────────────────────────────────────────
// Credential CRUD Operations
// ────────────────────────────────────────────────────────────────────────────

/// Save (upsert) a user credential with local machine-seed encryption.
pub fn save_credential(
    conn: &Connection,
    service_id: &str,
    credential_key: &str,
    token: &str,
) -> crate::errors::Result<()> {
    let encrypted_token = xor_encrypt(token);

    conn.execute(
        "INSERT INTO user_credentials (service_id, credential_key, token_value, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(service_id, credential_key)
         DO UPDATE SET token_value = ?3, updated_at = CURRENT_TIMESTAMP",
        rusqlite::params![service_id, credential_key, encrypted_token],
    )?;

    info!(
        "Credential saved for service '{}', key '{}'",
        service_id, credential_key
    );
    Ok(())
}

/// Retrieve and decrypt a single credential.
pub fn get_credential(
    conn: &Connection,
    service_id: &str,
    credential_key: &str,
) -> crate::errors::Result<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT token_value FROM user_credentials WHERE service_id = ?1 AND credential_key = ?2",
    )?;

    let result = stmt.query_row(
        rusqlite::params![service_id, credential_key],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(encrypted) => {
            let decrypted = xor_decrypt(&encrypted)?;
            Ok(Some(decrypted))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Database(e)),
    }
}

/// Retrieve all credentials for a given service (e.g., "slack", "gmail").
/// Returns a HashMap of credential_key -> decrypted_token_value.
pub fn get_credentials_for_service(
    conn: &Connection,
    service_id: &str,
) -> crate::errors::Result<HashMap<String, String>> {
    let mut stmt = conn.prepare(
        "SELECT credential_key, token_value FROM user_credentials WHERE service_id = ?1",
    )?;

    let rows = stmt.query_map(rusqlite::params![service_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut credentials = HashMap::new();
    for row in rows {
        if let Ok((key, encrypted_val)) = row {
            match xor_decrypt(&encrypted_val) {
                Ok(decrypted) => {
                    credentials.insert(key, decrypted);
                }
                Err(e) => {
                    warn!("Failed to decrypt credential '{}' for service '{}': {}", key, service_id, e);
                }
            }
        }
    }

    Ok(credentials)
}

/// Delete a specific credential.
pub fn delete_credential(
    conn: &Connection,
    service_id: &str,
    credential_key: &str,
) -> crate::errors::Result<()> {
    conn.execute(
        "DELETE FROM user_credentials WHERE service_id = ?1 AND credential_key = ?2",
        rusqlite::params![service_id, credential_key],
    )?;
    info!("Credential deleted for service '{}', key '{}'", service_id, credential_key);
    Ok(())
}

/// List all stored services (distinct service_ids).
pub fn list_connected_services(conn: &Connection) -> crate::errors::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT service_id FROM user_credentials ORDER BY service_id",
    )?;

    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut services = Vec::new();
    for row in rows {
        if let Ok(service) = row {
            services.push(service);
        }
    }
    Ok(services)
}

// ────────────────────────────────────────────────────────────────────────────
// Service-to-Environment Variable Mapping
// ────────────────────────────────────────────────────────────────────────────

/// Maps a service_id to the environment variables its MCP server process
/// expects. Returns a vec of (env_var_name, credential_key) tuples.
pub fn get_env_var_mapping(service_id: &str) -> Vec<(&'static str, &'static str)> {
    match service_id {
        "slack" => vec![
            ("SLACK_BOT_TOKEN", "bot_token"),
            ("SLACK_TEAM_ID", "team_id"),
        ],
        "gmail" | "google" => vec![
            ("GOOGLE_API_CREDENTIALS", "api_token"),
            ("GOOGLE_OAUTH_REFRESH_TOKEN", "refresh_token"),
        ],
        "calendly" => vec![
            ("CALENDLY_API_TOKEN", "api_token"),
        ],
        "notion" => vec![
            ("NOTION_API_KEY", "api_key"),
        ],
        "github" => vec![
            ("GITHUB_TOKEN", "access_token"),
        ],
        "linear" => vec![
            ("LINEAR_API_KEY", "api_key"),
        ],
        "hubspot" => vec![
            ("HUBSPOT_API_KEY", "api_key"),
        ],
        _ => vec![],
    }
}
