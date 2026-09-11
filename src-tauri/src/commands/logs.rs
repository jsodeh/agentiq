use tauri::State;
use crate::database::queries::Queries;
use crate::database::DbPool;
use crate::errors::AppError;

#[tauri::command]
pub async fn get_logs(
    pool: State<'_, DbPool>,
    limit: Option<i32>,
    _start_date: Option<u64>,
    _end_date: Option<u64>,
    agent_id: Option<i32>,
    level: Option<String>
) -> Result<String, AppError> {
    let conn = pool.get()?;
    let logs = Queries::get_logs(&conn, limit, agent_id.map(|id| id as i64), level.as_deref())?;
    let json_str = serde_json::to_string(&logs)?;
    Ok(json_str)
}

#[tauri::command]
pub async fn get_agent_tasks(
    pool: State<'_, DbPool>,
    agent_id: i32,
    limit: Option<i32>
) -> Result<String, AppError> {
    let conn = pool.get()?;
    let tasks = Queries::get_agent_tasks(&conn, agent_id as i64, limit)?;
    let json_str = serde_json::to_string(&tasks)?;
    Ok(json_str)
}
