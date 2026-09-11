pub mod models;
pub mod queries;
pub mod schema;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::fs;
use std::path::PathBuf;
use tracing::info;
use crate::errors::{AppError, Result};

pub type DbPool = Pool<SqliteConnectionManager>;

pub fn get_db_path() -> PathBuf {
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    
    PathBuf::from(home_dir)
        .join(".agentiq")
        .join("agentiq.db")
}

pub fn init_pool() -> Result<DbPool> {
    let db_path = get_db_path();
    
    if let Some(parent) = db_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }

    info!("Initializing SQLite connection pool at {:?}", db_path);
    let manager = SqliteConnectionManager::file(&db_path);
    let pool = Pool::builder()
        .max_size(15)
        .build(manager)
        .map_err(|e| AppError::Pool(e))?;

    // Execute schema migrations
    let conn = pool.get()?;
    schema::migrate(&conn)?;

    // Ensure default user exists
    queries::Queries::get_or_create_default_user(&conn)?;

    Ok(pool)
}
