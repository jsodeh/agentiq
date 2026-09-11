use r2d2::PooledConnection;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::params;
use serde_json::{json, Value};
use tracing::info;
use crate::database::models::*;
use crate::errors::Result;

pub type DbConn = PooledConnection<SqliteConnectionManager>;

pub struct Queries;

impl Queries {
    pub fn create_user(conn: &DbConn, name: &str, email: &str) -> Result<i64> {
        conn.execute(
            "INSERT INTO users (name, email) VALUES (?1, ?2)",
            params![name, email],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_or_create_default_user(conn: &DbConn) -> Result<i64> {
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
        if count == 0 {
            info!("No user found, creating Default User");
            Self::create_user(conn, "Default User", "user@agentiq.local")
        } else {
            let id: i64 = conn.query_row("SELECT id FROM users ORDER BY id ASC LIMIT 1", [], |row| row.get(0))?;
            Ok(id)
        }
    }

    pub fn create_agent(conn: &DbConn, user_id: i64, name: &str, agent_type: &str, config: Option<&str>) -> Result<i64> {
        let default_config = json!({
            "systemPrompt": "You are a helpful AI assistant.",
            "tools": [],
            "autonomyLevel": "medium"
        }).to_string();

        let cfg = config.unwrap_or(&default_config);

        conn.execute(
            "INSERT INTO agents (user_id, name, type, status, config) VALUES (?1, ?2, ?3, 'active', ?4)",
            params![user_id, name, agent_type, cfg],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_or_create_agent(conn: &DbConn, agent_type: &str, user_id: i64) -> Result<i64> {
        let mut stmt = conn.prepare("SELECT id FROM agents WHERE type = ?1 AND user_id = ?2 LIMIT 1")?;
        let existing: Option<i64> = stmt.query_row(params![agent_type, user_id], |row| row.get(0)).ok();

        if let Some(id) = existing {
            Ok(id)
        } else {
            Self::create_agent(conn, user_id, agent_type, agent_type, None)
        }
    }

    pub fn create_task(conn: &DbConn, agent_id: i64, description: &str) -> Result<i64> {
        conn.execute(
            "INSERT INTO tasks (agent_id, description, status) VALUES (?1, ?2, 'pending')",
            params![agent_id, description],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_task_status(conn: &DbConn, task_id: i64, status: &str, result: Option<&str>) -> Result<()> {
        if let Some(res) = result {
            conn.execute(
                "UPDATE tasks SET status = ?1, result = ?2, completed_at = CURRENT_TIMESTAMP WHERE id = ?3",
                params![status, res, task_id],
            )?;
        } else {
            conn.execute(
                "UPDATE tasks SET status = ?1 WHERE id = ?2",
                params![status, task_id],
            )?;
        }
        Ok(())
    }

    pub fn get_agent_tasks(conn: &DbConn, agent_id: i64, limit: Option<i32>) -> Result<Vec<Task>> {
        let lim = limit.unwrap_or(50);
        let mut stmt = conn.prepare(
            "SELECT id, agent_id, description, status, result, priority, created_at, completed_at FROM tasks WHERE agent_id = ?1 ORDER BY created_at DESC LIMIT ?2"
        )?;

        let task_iter = stmt.query_map(params![agent_id, lim], |row| {
            Ok(Task {
                id: row.get(0)?,
                agent_id: row.get(1)?,
                description: row.get(2)?,
                status: row.get(3)?,
                result: row.get(4)?,
                priority: row.get(5)?,
                created_at: row.get(6)?,
                completed_at: row.get(7)?,
            })
        })?;

        let mut tasks = Vec::new();
        for task in task_iter {
            tasks.push(task?);
        }
        Ok(tasks)
    }

    pub fn create_conversation(conn: &DbConn, agent_id: i64, title: &str) -> Result<i64> {
        conn.execute(
            "INSERT INTO conversations (agent_id, title) VALUES (?1, ?2)",
            params![agent_id, title],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn add_message(conn: &DbConn, conversation_id: i64, role: &str, content: &str) -> Result<i64> {
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?1, ?2, ?3)",
            params![conversation_id, role, content],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_conversation_messages(conn: &DbConn, conversation_id: i64) -> Result<Vec<Message>> {
        let mut stmt = conn.prepare(
            "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC"
        )?;

        let msg_iter = stmt.query_map(params![conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut messages = Vec::new();
        for msg in msg_iter {
            messages.push(msg?);
        }
        Ok(messages)
    }

    pub fn create_log(conn: &DbConn, agent_id: i64, level: &str, message: &str, metadata: Option<&Value>) -> Result<i64> {
        let meta_str = metadata.map(|m| m.to_string());
        conn.execute(
            "INSERT INTO logs (agent_id, level, message, metadata) VALUES (?1, ?2, ?3, ?4)",
            params![agent_id, level, message, meta_str],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_logs(
        conn: &DbConn,
        limit: Option<i32>,
        agent_id: Option<i64>,
        level: Option<&str>
    ) -> Result<Vec<Log>> {
        let lim = limit.unwrap_or(100);
        let mut query = String::from("SELECT id, agent_id, level, message, metadata, created_at FROM logs WHERE 1=1");

        if agent_id.is_some() {
            query.push_str(" AND agent_id = :agent_id");
        }
        if level.is_some() {
            query.push_str(" AND level = :level");
        }
        query.push_str(" ORDER BY created_at DESC LIMIT :limit");

        let mut stmt = conn.prepare(&query)?;
        
        let mut params_vec: Vec<(&str, &dyn rusqlite::ToSql)> = vec![(":limit", &lim)];
        if let Some(ref aid) = agent_id {
            params_vec.push((":agent_id", aid));
        }
        if let Some(ref lvl) = level {
            params_vec.push((":level", lvl));
        }

        let log_iter = stmt.query_map(params_vec.as_slice(), |row| {
            Ok(Log {
                id: row.get(0)?,
                agent_id: row.get(1)?,
                level: row.get(2)?,
                message: row.get(3)?,
                metadata: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }
        Ok(logs)
    }

    pub fn get_pending_tasks(conn: &DbConn) -> Result<Vec<Task>> {
        let mut stmt = conn.prepare(
            "SELECT id, agent_id, description, status, result, priority, created_at, completed_at FROM tasks WHERE status = 'pending' ORDER BY created_at ASC"
        )?;

        let task_iter = stmt.query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                agent_id: row.get(1)?,
                description: row.get(2)?,
                status: row.get(3)?,
                result: row.get(4)?,
                priority: row.get(5)?,
                created_at: row.get(6)?,
                completed_at: row.get(7)?,
            })
        })?;

        let mut tasks = Vec::new();
        for task in task_iter {
            tasks.push(task?);
        }
        Ok(tasks)
    }
}

pub fn get_agent_by_id(conn: &DbConn, agent_id: i64) -> Result<Option<Agent>> {
    let mut stmt = conn.prepare("SELECT id, user_id, name, type, status, config, created_at FROM agents WHERE id = ?1")?;
    let agent = stmt.query_row(params![agent_id], |row| {
        Ok(Agent {
            id: row.get(0)?,
            user_id: row.get(1)?,
            name: row.get(2)?,
            r#type: row.get(3)?,
            status: row.get(4)?,
            config: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).ok();
    Ok(agent)
}

pub fn update_task_status(conn: &DbConn, task_id: i64, status: &str, result: Option<&str>) -> Result<()> {
    Queries::update_task_status(conn, task_id, status, result)
}

pub fn create_log(conn: &DbConn, _task_id: i64, agent_id: i64, level: &str, message: &str, metadata: Option<&str>) -> Result<i64> {
    let val: Option<Value> = metadata.and_then(|m| serde_json::from_str(m).ok());
    Queries::create_log(conn, agent_id, level, message, val.as_ref())
}

pub fn get_pending_tasks(conn: &DbConn) -> Result<Vec<Task>> {
    Queries::get_pending_tasks(conn)
}
