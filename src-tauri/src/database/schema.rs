use rusqlite::Connection;
use tracing::info;
use crate::errors::{AppError, Result};

pub const SCHEMA_SQL: &str = include_str!("../../../src/db/schema.sql");

pub fn migrate(conn: &Connection) -> Result<()> {
    info!("Executing database schema initialization & migrations");
    
    // Execute base schema
    conn.execute_batch(SCHEMA_SQL)
        .map_err(|e| AppError::Database(e))?;

    // Incremental migrations for pure Rust backend
    migrate_tasks_table(conn)?;
    migrate_runtime_executions_table(conn)?;

    Ok(())
}

fn migrate_tasks_table(conn: &Connection) -> Result<()> {
    // Check if priority column exists in tasks table
    let mut stmt = conn.prepare("PRAGMA table_info(tasks)")?;
    let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;
    
    let mut has_priority = false;
    for col in columns {
        if let Ok(name) = col {
            if name == "priority" {
                has_priority = true;
                break;
            }
        }
    }

    if !has_priority {
        info!("Adding 'priority' column to 'tasks' table");
        conn.execute("ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0", [])?;
    }

    Ok(())
}

fn migrate_runtime_executions_table(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS runtime_executions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            turns_used INTEGER NOT NULL DEFAULT 0,
            tokens_used INTEGER NOT NULL DEFAULT 0,
            pending_tool_name TEXT,
            pending_tool_params TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_runtime_executions_conv ON runtime_executions(conversation_id)",
        [],
    )?;

    Ok(())
}

