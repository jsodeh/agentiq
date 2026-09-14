use rusqlite::{params, Connection};
use crate::database::models::SystemMemory;
use crate::errors::Result;

pub struct MemoryQueries;

impl MemoryQueries {
    pub fn set_fact(
        conn: &Connection,
        key: &str,
        value: &str,
        category: &str,
    ) -> Result<()> {
        conn.execute(
            "INSERT INTO system_memory (key, value, category) VALUES (?1, ?2, ?3) \
             ON CONFLICT(key) DO UPDATE SET value = ?2, category = ?3, updated_at = CURRENT_TIMESTAMP",
            params![key, value, category],
        )?;
        Ok(())
    }

    pub fn get_all_facts(conn: &Connection) -> Result<Vec<SystemMemory>> {
        let mut stmt = conn.prepare(
            "SELECT id, user_id, key, value, category, updated_at FROM system_memory ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SystemMemory {
                id: row.get(0)?,
                user_id: row.get(1)?,
                key: row.get(2)?,
                value: row.get(3)?,
                category: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        let mut facts = Vec::new();
        for fact in rows {
            facts.push(fact?);
        }
        Ok(facts)
    }

    pub fn get_fact(conn: &Connection, key: &str) -> Result<Option<String>> {
        let mut stmt = conn.prepare("SELECT value FROM system_memory WHERE key = ?1")?;
        let res = stmt.query_row(params![key], |row| row.get(0)).ok();
        Ok(res)
    }
}
