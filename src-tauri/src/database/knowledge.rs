use rusqlite::{params, Connection};
use crate::database::models::KnowledgeItem;
use crate::errors::Result;

pub struct KnowledgeQueries;

impl KnowledgeQueries {
    pub fn add_item(
        conn: &Connection,
        title: &str,
        content: &str,
        category: &str,
        tags: Option<&str>,
    ) -> Result<i64> {
        conn.execute(
            "INSERT INTO knowledge_base (title, content, category, tags) VALUES (?1, ?2, ?3, ?4)",
            params![title, content, category, tags],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_all_items(conn: &Connection) -> Result<Vec<KnowledgeItem>> {
        let mut stmt = conn.prepare(
            "SELECT id, title, content, category, tags, created_at FROM knowledge_base ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(KnowledgeItem {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                category: row.get(3)?,
                tags: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        let mut items = Vec::new();
        for item in rows {
            items.push(item?);
        }
        Ok(items)
    }

    pub fn delete_item(conn: &Connection, id: i64) -> Result<()> {
        conn.execute("DELETE FROM knowledge_base WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn search_items(conn: &Connection, query: &str) -> Result<Vec<KnowledgeItem>> {
        let search_pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT id, title, content, category, tags, created_at FROM knowledge_base WHERE title LIKE ?1 OR content LIKE ?1 OR tags LIKE ?1 ORDER BY created_at DESC LIMIT 10",
        )?;
        let rows = stmt.query_map(params![search_pattern], |row| {
            Ok(KnowledgeItem {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                category: row.get(3)?,
                tags: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        let mut items = Vec::new();
        for item in rows {
            items.push(item?);
        }
        Ok(items)
    }
}
