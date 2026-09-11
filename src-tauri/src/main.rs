#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agents;
mod commands;
mod config;
mod database;
mod errors;
mod llm;
mod logging;
mod orchestrator;
mod tools;

use parking_lot::Mutex as ParkingMutex;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tracing::info;

use agents::AgentPluginRegistry;
use config::AppConfig;
use database::init_pool;
use orchestrator::NativeOrchestratorState;

fn main() {
    logging::init_logging();
    info!("Starting AgentIQ Pure Rust Core...");

    let app_config = Arc::new(ParkingMutex::new(
        AppConfig::load().unwrap_or_default(),
    ));
    let db_pool = init_pool().expect("Failed to initialize database connection pool");

    let mut registry = AgentPluginRegistry::new();
    registry.load_defaults();
    let custom_plugins_dir = AppConfig::get_config_dir().join("plugins");
    let _ = registry.load_from_dir(&custom_plugins_dir);
    let agent_registry = Arc::new(registry);

    let native_orchestrator = NativeOrchestratorState::new(
        db_pool.clone(),
        app_config.clone(),
        agent_registry.clone(),
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .manage(db_pool)
        .manage(app_config)
        .manage(agent_registry)
        .manage(native_orchestrator)
        .setup(|app| {
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let start_all =
                MenuItem::with_id(app, "start_all", "Start All Agents", true, None::<&str>)?;
            let stop_all =
                MenuItem::with_id(app, "stop_all", "Stop All Agents", true, None::<&str>)?;
            let dashboard =
                MenuItem::with_id(app, "dashboard", "Open Dashboard", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&dashboard, &start_all, &stop_all, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
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
                        info!("Starting all agents");
                    }
                    "stop_all" => {
                        info!("Stopping all agents");
                    }
                    _ => {}
                })
                .build(app)?;

            #[cfg(desktop)]
            app.deep_link().on_open_url(|event| {
                info!("Deep link received: {:?}", event.urls());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Agent management commands
            commands::agents::start_agent,
            commands::agents::stop_agent,
            commands::agents::stop_all_agents,
            commands::agents::prepare_task,
            commands::agents::save_agent_configs,
            // Database & Chat commands
            commands::database::init_database,
            commands::database::create_task,
            commands::database::create_conversation,
            commands::database::add_message,
            commands::database::get_conversation_messages,
            commands::database::update_task_status,
            commands::database::get_or_create_agent,
            commands::chat::send_chat_message,
            // System & setup commands
            commands::system::check_ollama,
            commands::system::download_ollama,
            commands::system::get_ram_gb,
            commands::system::get_free_disk_gb,
            commands::system::get_gpu_info,
            commands::system::check_internet,
            commands::system::download_model,
            commands::system::verify_model_checksum,
            // Voice commands
            commands::voice::download_voice_model,
            commands::voice::start_voice_recording,
            commands::voice::transcribe_audio,
            commands::voice::speak_text,
            commands::voice::check_whisper_binary,
            commands::voice::check_tts_binary,
            commands::voice::whisper_transcribe,
            commands::voice::coqui_tts_speak,
            // Orchestrator commands
            commands::orchestrator::start_orchestrator,
            commands::orchestrator::stop_orchestrator,
            commands::orchestrator::get_orchestrator_status,
            commands::orchestrator::get_llm_config,
            commands::orchestrator::update_llm_config,
            // Computer Use commands
            commands::computer_use::create_directory,
            commands::computer_use::get_file_info,
            commands::computer_use::delete_file,
            commands::computer_use::copy_file,
            commands::computer_use::log_browser_action,
            commands::computer_use::update_session_recording,
            commands::computer_use::save_recording,
            commands::computer_use::get_recording,
            commands::computer_use::get_all_recordings,
            commands::computer_use::get_recordings_by_session,
            commands::computer_use::star_recording,
            commands::computer_use::delete_recording,
            commands::computer_use::generate_video_thumbnail,
            commands::computer_use::log_approval_decision,
            commands::computer_use::get_approval_history,
            commands::computer_use::capture_screen,
            commands::computer_use::capture_window,
            commands::computer_use::get_screens,
            commands::computer_use::capture_screen_to_buffer,
            commands::computer_use::log_verification_capture,
            commands::computer_use::cleanup_old_captures,
            commands::computer_use::get_capture_stats,
            commands::computer_use::get_live_screenshot,
            // Log & query commands
            commands::logs::get_logs,
            commands::logs::get_agent_tasks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
