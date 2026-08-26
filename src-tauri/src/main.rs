#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    Manager, 
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};
use sysinfo::{System, Disks};
use std::process::{Command, Child, Stdio};
use std::sync::Mutex;

// Global state for orchestrator process
struct OrchestratorState {
    process: Option<Child>,
    running: bool,
}

impl OrchestratorState {
    fn new() -> Self {
        Self {
            process: None,
            running: false,
        }
    }
}

#[tauri::command]
fn start_agent(agent_id: i32) -> Result<String, String> {
    println!("Starting agent: {}", agent_id);
    Ok(format!("Agent {} started", agent_id))
}

#[tauri::command]
fn stop_agent(agent_id: i32) -> Result<String, String> {
    println!("Stopping agent: {}", agent_id);
    Ok(format!("Agent {} stopped", agent_id))
}

#[tauri::command]
fn stop_all_agents() -> Result<String, String> {
    println!("Stopping all agents");
    Ok("All agents stopped".to_string())
}

#[tauri::command]
fn check_ollama() -> Result<bool, String> {
    // Check if Ollama is installed by running "ollama --version"
    match Command::new("ollama").arg("--version").output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
fn get_ram_gb() -> Result<f64, String> {
    let mut sys = System::new_all();
    sys.refresh_memory();
    let total_memory = sys.total_memory() as f64;
    let ram_gb = total_memory / 1_073_741_824.0; // Convert bytes to GB
    Ok(ram_gb)
}

#[tauri::command]
fn get_free_disk_gb() -> Result<f64, String> {
    let disks = Disks::new_with_refreshed_list();
    let mut total_free = 0u64;
    
    for disk in disks.list() {
        total_free += disk.available_space();
    }
    
    let free_gb = total_free as f64 / 1_073_741_824.0; // Convert bytes to GB
    Ok(free_gb)
}

#[tauri::command]
fn get_gpu_info() -> Result<String, String> {
    // Try to get GPU info using system commands
    #[cfg(target_os = "macos")]
    {
        match Command::new("system_profiler")
            .arg("SPDisplaysDataType")
            .output()
        {
            Ok(output) => {
                let info = String::from_utf8_lossy(&output.stdout);
                // Extract GPU name from output
                for line in info.lines() {
                    if line.contains("Chipset Model:") {
                        return Ok(line.split(':').nth(1).unwrap_or("Unknown").trim().to_string());
                    }
                }
                Ok("Unknown GPU".to_string())
            }
            Err(_) => Ok("Unknown GPU".to_string()),
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        match Command::new("lspci").output() {
            Ok(output) => {
                let info = String::from_utf8_lossy(&output.stdout);
                for line in info.lines() {
                    if line.contains("VGA") || line.contains("3D") {
                        return Ok(line.split(':').last().unwrap_or("Unknown").trim().to_string());
                    }
                }
                Ok("Unknown GPU".to_string())
            }
            Err(_) => Ok("Unknown GPU".to_string()),
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        match Command::new("wmic")
            .args(&["path", "win32_VideoController", "get", "name"])
            .output()
        {
            Ok(output) => {
                let info = String::from_utf8_lossy(&output.stdout);
                let lines: Vec<&str> = info.lines().collect();
                if lines.len() > 1 {
                    return Ok(lines[1].trim().to_string());
                }
                Ok("Unknown GPU".to_string())
            }
            Err(_) => Ok("Unknown GPU".to_string()),
        }
    }
}

#[tauri::command]
fn check_internet() -> Result<bool, String> {
    // Try to connect to a reliable host
    match Command::new("ping")
        .arg("-c")
        .arg("1")
        .arg("8.8.8.8")
        .output()
    {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn download_model(model_id: String, app: tauri::AppHandle) -> Result<(), String> {
    // Simulate model download with progress events
    // In production, this would use Ollama's API
    tokio::spawn(async move {
        let total_size = 5_000_000_000u64; // 5GB example
        let chunk_size = 50_000_000u64; // 50MB chunks
        
        for downloaded in (0..=total_size).step_by(chunk_size as usize) {
            let progress = serde_json::json!({
                "downloaded": downloaded,
                "total": total_size,
                "speed": 10_000_000, // 10 MB/s
                "eta": (total_size - downloaded) / 10_000_000,
            });
            
            let _ = app.emit("download_progress", progress);
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    });
    
    Ok(())
}

#[tauri::command]
fn verify_model_checksum(model_id: String) -> Result<bool, String> {
    // In production, verify SHA-256 checksum
    // For now, simulate verification
    std::thread::sleep(std::time::Duration::from_secs(1));
    Ok(true)
}

#[tauri::command]
fn save_agent_configs(configs: serde_json::Value) -> Result<(), String> {
    // Save agent configurations to database
    // For now, just log
    println!("Saving agent configs: {:?}", configs);
    Ok(())
}

#[tauri::command]
async fn download_voice_model(model_name: String, app: tauri::AppHandle) -> Result<(), String> {
    // Simulate voice model download with progress
    tokio::spawn(async move {
        for progress in (0..=100).step_by(5) {
            let _ = app.emit("voice_model_download_progress", serde_json::json!({ "progress": progress }));
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    });
    Ok(())
}

#[tauri::command]
async fn start_voice_recording(duration: u64) -> Result<(), String> {
    // Start recording audio for specified duration
    println!("Recording audio for {} seconds", duration);
    Ok(())
}

#[tauri::command]
async fn transcribe_audio(language: String, use_cloud: bool, api_key: Option<String>) -> Result<String, String> {
    // Transcribe recorded audio
    // For now, return mock transcription
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    Ok("This is a test transcription".to_string())
}

#[tauri::command]
async fn speak_text(text: String, language: String, use_cloud: bool, api_key: Option<String>) -> Result<(), String> {
    // Convert text to speech and play
    println!("Speaking: {}", text);
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    Ok(())
}

#[tauri::command]
async fn start_orchestrator() -> Result<(), String> {
    // Start the agent orchestrator
    println!("Starting orchestrator...");
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    Ok(())
}

#[tauri::command]
fn check_whisper_binary() -> Result<bool, String> {
    // Check if whisper.cpp binary exists in resources
    // In production, check bundled resources path
    // For now, check if whisper command is available
    match Command::new("whisper").arg("--version").output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
fn check_tts_binary() -> Result<bool, String> {
    // Check if coqui-tts binary exists in resources
    // In production, check bundled resources path
    match Command::new("tts").arg("--version").output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn whisper_transcribe(
    audio_data: Vec<f32>,
    language: String,
    model: String
) -> Result<String, String> {
    // In production, this would:
    // 1. Write audio_data to temporary WAV file
    // 2. Spawn whisper.cpp binary with the file
    // 3. Parse output and return transcript
    
    // For now, simulate transcription
    println!("Transcribing {} samples in {} using {}", audio_data.len(), language, model);
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    Ok("Transcribed text from whisper.cpp".to_string())
}

#[tauri::command]
async fn coqui_tts_speak(
    text: String,
    language: String,
    model: String
) -> Result<(), String> {
    // In production, this would:
    // 1. Spawn coqui-tts binary with text input
    // 2. Generate audio file
    // 3. Play audio using system audio player
    
    println!("Speaking '{}' in {} using {}", text, language, model);
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    Ok(())
}

// Computer Use Commands

#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_file_info(path: String) -> Result<serde_json::Value, String> {
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to get file info: {}", e))?;
    
    Ok(serde_json::json!({
        "size": metadata.len(),
        "modified": metadata.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())),
    }))
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn copy_file(source: String, destination: String) -> Result<(), String> {
    std::fs::copy(&source, &destination)
        .map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn log_browser_action(
    session_id: String,
    agent_id: i32,
    action: String
) -> Result<(), String> {
    // In production, save to SQLite database
    println!("Logging browser action for session {}: {}", session_id, action);
    Ok(())
}

#[tauri::command]
async fn update_session_recording(
    session_id: String,
    recording_path: String
) -> Result<(), String> {
    // In production, update database with recording path
    println!("Updated session {} with recording: {}", session_id, recording_path);
    Ok(())
}

#[tauri::command]
async fn save_recording(recording: String) -> Result<(), String> {
    // In production, save to database
    println!("Saving recording: {}", recording);
    Ok(())
}

#[tauri::command]
async fn get_recording(recording_id: String) -> Result<String, String> {
    // In production, fetch from database
    Ok(serde_json::json!({
        "id": recording_id,
        "sessionId": "mock_session",
        "agentId": 1,
        "filePath": "/path/to/recording.mp4",
        "fileSize": 1024000,
        "duration": 120,
        "startTime": 1234567890000u64,
        "endTime": 1234567890000u64,
        "starred": false,
    }).to_string())
}

#[tauri::command]
async fn get_all_recordings(agent_id: Option<i32>) -> Result<String, String> {
    // In production, fetch from database
    Ok("[]".to_string())
}

#[tauri::command]
async fn get_recordings_by_session(session_id: String) -> Result<String, String> {
    // In production, fetch from database
    Ok("[]".to_string())
}

#[tauri::command]
async fn star_recording(recording_id: String, starred: bool) -> Result<(), String> {
    // In production, update database
    println!("Recording {} starred: {}", recording_id, starred);
    Ok(())
}

#[tauri::command]
async fn delete_recording(recording_id: String) -> Result<(), String> {
    // In production, delete from database
    println!("Deleted recording: {}", recording_id);
    Ok(())
}

#[tauri::command]
async fn generate_video_thumbnail(
    video_path: String,
    thumbnail_path: String,
    timestamp: u64
) -> Result<(), String> {
    // In production, use ffmpeg to generate thumbnail
    println!("Generating thumbnail for {} at {}s", video_path, timestamp);
    Ok(())
}

#[tauri::command]
async fn log_approval_decision(decision: String) -> Result<(), String> {
    // In production, save to database
    println!("Logging approval decision: {}", decision);
    Ok(())
}

#[tauri::command]
async fn get_approval_history(agent_id: Option<i32>, limit: i32) -> Result<String, String> {
    // In production, fetch from database
    Ok("[]".to_string())
}

#[tauri::command]
async fn capture_screen(
    display_id: Option<i32>,
    region: Option<String>,
    output_path: String,
    format: String,
    quality: i32
) -> Result<String, String> {
    // In production, use platform-specific screen capture
    println!("Capturing screen to: {}", output_path);
    
    // Mock response
    Ok(serde_json::json!({
        "width": 1920,
        "height": 1080,
        "fileSize": 500000,
    }).to_string())
}

#[tauri::command]
async fn capture_window(
    window_title: String,
    output_path: String
) -> Result<String, String> {
    // In production, capture specific window
    println!("Capturing window '{}' to: {}", window_title, output_path);
    
    Ok(serde_json::json!({
        "width": 1920,
        "height": 1080,
        "fileSize": 500000,
    }).to_string())
}

#[tauri::command]
async fn get_screens() -> Result<String, String> {
    // In production, get actual screen info
    Ok(serde_json::json!([
        {
            "id": 0,
            "name": "Primary Display",
            "width": 1920,
            "height": 1080,
            "isPrimary": true,
        }
    ]).to_string())
}

#[tauri::command]
async fn capture_screen_to_buffer(
    display_id: Option<i32>,
    region: Option<String>,
    format: String,
    quality: i32
) -> Result<Vec<u8>, String> {
    // In production, return actual screenshot buffer
    Ok(vec![])
}

#[tauri::command]
async fn log_verification_capture(
    action_id: String,
    agent_id: i32,
    capture_path: String,
    timestamp: u64
) -> Result<(), String> {
    // In production, save to database
    println!("Logged verification capture for action {}", action_id);
    Ok(())
}

#[tauri::command]
async fn cleanup_old_captures(directory: String, cutoff_time: u64) -> Result<(), String> {
    // In production, delete old files
    println!("Cleaning up captures in {} older than {}", directory, cutoff_time);
    Ok(())
}

#[tauri::command]
async fn get_capture_stats(directory: String) -> Result<String, String> {
    // In production, scan directory and return stats
    Ok(serde_json::json!({
        "totalCaptures": 0,
        "totalSize": 0,
        "oldestCapture": 0,
        "newestCapture": 0,
    }).to_string())
}

#[tauri::command]
async fn get_live_screenshot(agent_id: Option<i32>) -> Result<String, String> {
    // In production, get current browser screenshot as base64
    Ok("".to_string())
}

#[tauri::command]
async fn get_logs(
    limit: Option<i32>,
    start_date: Option<u64>,
    end_date: Option<u64>,
    agent_id: Option<i32>,
    level: Option<String>
) -> Result<String, String> {
    // In production, query SQLite database with filters
    // For now, return mock logs
    let mock_logs = serde_json::json!([
        {
            "id": "log_1",
            "agentId": 1,
            "agentName": "Lead Gen Agent",
            "level": "info",
            "message": "Started scraping Google Maps for Lagos restaurants",
            "timestamp": chrono::Utc::now().timestamp_millis() - 3600000,
            "actionType": "scrape",
            "metadata": {
                "location": "Lagos, Nigeria",
                "category": "restaurants",
                "results": 45
            }
        },
        {
            "id": "log_2",
            "agentId": 2,
            "agentName": "Cold Outreach Agent",
            "level": "success",
            "message": "Sent 12 personalized emails to prospects",
            "timestamp": chrono::Utc::now().timestamp_millis() - 1800000,
            "actionType": "email_sent",
            "metadata": {
                "sent": 12,
                "bounced": 0,
                "opened": 3
            }
        },
        {
            "id": "log_3",
            "agentId": 3,
            "agentName": "WhatsApp Support",
            "level": "warning",
            "message": "High message volume detected - 45 messages in queue",
            "timestamp": chrono::Utc::now().timestamp_millis() - 900000,
            "actionType": "queue_alert",
            "metadata": {
                "queueSize": 45,
                "avgResponseTime": 120
            }
        },
        {
            "id": "log_4",
            "agentId": 1,
            "agentName": "Lead Gen Agent",
            "level": "error",
            "message": "Failed to connect to Google Maps API - rate limit exceeded",
            "timestamp": chrono::Utc::now().timestamp_millis() - 300000,
            "actionType": "api_error",
            "metadata": {
                "error": "RateLimitExceeded",
                "retryAfter": 3600
            }
        }
    ]);
    
    Ok(mock_logs.to_string())
}

#[tauri::command]
async fn get_agent_tasks(
    agent_id: i32,
    limit: Option<i32>
) -> Result<String, String> {
    // In production, query SQLite database
    // For now, return mock tasks
    let mock_tasks = serde_json::json!([
        {
            "id": "task_1",
            "agentId": agent_id,
            "description": "Scrape 50 restaurants from Google Maps in Lagos",
            "status": "completed",
            "createdAt": chrono::Utc::now().timestamp_millis() - 7200000,
            "completedAt": chrono::Utc::now().timestamp_millis() - 3600000,
            "result": "Successfully scraped 48 restaurants with contact details"
        },
        {
            "id": "task_2",
            "agentId": agent_id,
            "description": "Send cold outreach emails to 20 prospects",
            "status": "in_progress",
            "createdAt": chrono::Utc::now().timestamp_millis() - 1800000,
        },
        {
            "id": "task_3",
            "agentId": agent_id,
            "description": "Generate weekly performance report",
            "status": "pending",
            "createdAt": chrono::Utc::now().timestamp_millis() - 900000,
        }
    ]);
    
    Ok(mock_tasks.to_string())
}

#[tauri::command]
async fn start_orchestrator_sidecar(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<OrchestratorState>>
) -> Result<String, String> {
    let mut orch_state = state.lock().map_err(|e| e.to_string())?;
    
    if orch_state.running {
        return Ok("Orchestrator already running".to_string());
    }

    // Spawn Node.js orchestrator as sidecar
    // In production, this would be a bundled Node.js script
    let child = Command::new("node")
        .arg("orchestrator-sidecar.js")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn orchestrator: {}", e))?;

    orch_state.process = Some(child);
    orch_state.running = true;

    Ok("Orchestrator started".to_string())
}

#[tauri::command]
async fn stop_orchestrator_sidecar(
    state: tauri::State<'_, Mutex<OrchestratorState>>
) -> Result<String, String> {
    let mut orch_state = state.lock().map_err(|e| e.to_string())?;
    
    if !orch_state.running {
        return Ok("Orchestrator not running".to_string());
    }

    if let Some(mut process) = orch_state.process.take() {
        process.kill().map_err(|e| format!("Failed to kill orchestrator: {}", e))?;
    }

    orch_state.running = false;

    Ok("Orchestrator stopped".to_string())
}

#[tauri::command]
fn get_orchestrator_status(
    state: tauri::State<'_, Mutex<OrchestratorState>>
) -> Result<serde_json::Value, String> {
    let orch_state = state.lock().map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "running": orch_state.running,
        "pid": orch_state.process.as_ref().map(|p| p.id()),
    }))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(OrchestratorState::new()))
        .setup(|app| {
            // Setup system tray
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let start_all = MenuItem::with_id(app, "start_all", "Start All Agents", true, None::<&str>)?;
            let stop_all = MenuItem::with_id(app, "stop_all", "Stop All Agents", true, None::<&str>)?;
            let dashboard = MenuItem::with_id(app, "dashboard", "Open Dashboard", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[
                &dashboard,
                &start_all,
                &stop_all,
                &quit_item,
            ])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "dashboard" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "start_all" => {
                            println!("Starting all agents");
                        }
                        "stop_all" => {
                            println!("Stopping all agents");
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Register deep link handler
            tauri_plugin_deep_link::register("agent", move |_app, matches| {
                println!("Deep link received: {:?}", matches);
            })?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_agent,
            stop_agent,
            stop_all_agents,
            check_ollama,
            get_ram_gb,
            get_free_disk_gb,
            get_gpu_info,
            check_internet,
            download_model,
            verify_model_checksum,
            save_agent_configs,
            download_voice_model,
            start_voice_recording,
            transcribe_audio,
            speak_text,
            start_orchestrator,
            start_orchestrator_sidecar,
            stop_orchestrator_sidecar,
            get_orchestrator_status,
            check_whisper_binary,
            check_tts_binary,
            whisper_transcribe,
            coqui_tts_speak,
            // Computer Use commands
            create_directory,
            get_file_info,
            delete_file,
            copy_file,
            log_browser_action,
            update_session_recording,
            save_recording,
            get_recording,
            get_all_recordings,
            get_recordings_by_session,
            star_recording,
            delete_recording,
            generate_video_thumbnail,
            log_approval_decision,
            get_approval_history,
            capture_screen,
            capture_window,
            get_screens,
            capture_screen_to_buffer,
            log_verification_capture,
            cleanup_old_captures,
            get_capture_stats,
            get_live_screenshot,
            get_logs,
            get_agent_tasks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
