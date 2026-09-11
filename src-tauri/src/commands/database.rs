use tauri::State;
use crate::database::queries::Queries;
use crate::database::DbPool;
use crate::errors::AppError;

#[tauri::command]
pub fn init_database(pool: State<'_, DbPool>) -> Result<(), AppError> {
    let conn = pool.get()?;
    crate::database::schema::migrate(&conn)?;
    Queries::get_or_create_default_user(&conn)?;
    Ok(())
}

#[tauri::command]
pub fn create_task(
    pool: State<'_, DbPool>,
    agent_id: i64,
    description: String,
) -> Result<i64, AppError> {
    let conn = pool.get()?;
    let id = Queries::create_task(&conn, agent_id, &description)?;
    Ok(id)
}

#[tauri::command]
pub fn create_conversation(
    pool: State<'_, DbPool>,
    agent_id: i64,
    title: String,
) -> Result<i64, AppError> {
    let conn = pool.get()?;
    let id = Queries::create_conversation(&conn, agent_id, &title)?;
    Ok(id)
}

#[tauri::command]
pub fn add_message(
    pool: State<'_, DbPool>,
    conversation_id: i64,
    role: String,
    content: String,
) -> Result<i64, AppError> {
    let conn = pool.get()?;
    let id = Queries::add_message(&conn, conversation_id, &role, &content)?;
    Ok(id)
}

#[tauri::command]
pub fn get_conversation_messages(
    pool: State<'_, DbPool>,
    conversation_id: i64,
) -> Result<String, AppError> {
    let conn = pool.get()?;
    let messages = Queries::get_conversation_messages(&conn, conversation_id)?;
    let serialized = serde_json::to_string(&messages)?;
    Ok(serialized)
}

#[tauri::command]
pub fn update_task_status(
    pool: State<'_, DbPool>,
    task_id: i64,
    status: String,
    result: Option<String>,
) -> Result<(), AppError> {
    let conn = pool.get()?;
    Queries::update_task_status(&conn, task_id, &status, result.as_deref())?;
    Ok(())
}

#[tauri::command]
pub fn get_or_create_agent(
    pool: State<'_, DbPool>,
    agent_type: String,
    user_id: i32,
) -> Result<i64, AppError> {
    let conn = pool.get()?;
    let id = Queries::get_or_create_agent(&conn, &agent_type, user_id as i64)?;
    Ok(id)
}
