use sysinfo::{Disks, System};
use std::process::Command;
use tauri::Emitter;
use crate::errors::AppError;

fn ollama_command() -> Command {
    #[cfg(target_os = "windows")]
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let executable = PathBuf::from(local_app_data).join("Programs").join("Ollama").join("ollama.exe");
        if executable.exists() {
            return Command::new(executable);
        }
    }

    Command::new("ollama")
}

#[tauri::command]
pub fn check_ollama() -> Result<bool, AppError> {
    match ollama_command().arg("--version").output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn download_ollama(app: tauri::AppHandle) -> Result<(), AppError> {
    let installer_app = app.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let _ = installer_app.emit("ollama_install_progress", serde_json::json!({ "stage": "download", "message": "Downloading Ollama runtime" }));

        #[cfg(target_os = "windows")]
        let output = Command::new("powershell")
            .args([
                "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command",
                "$ErrorActionPreference = 'Stop'; $installer = Join-Path $env:TEMP 'OllamaSetup.exe'; Invoke-WebRequest -UseBasicParsing -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile $installer; Start-Process -FilePath $installer -ArgumentList '/S' -Wait"
            ])
            .output()
            .map_err(|error| AppError::Execution(format!("Could not start the Ollama installer: {error}")))?;

        #[cfg(any(target_os = "macos", target_os = "linux"))]
        let output = Command::new("sh")
            .args(["-c", "curl -fsSL https://ollama.com/install.sh | sh"])
            .output()
            .map_err(|error| AppError::Execution(format!("Could not start the Ollama installer: {error}")))?;

        if !output.status.success() {
            let details = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(AppError::Execution(if details.is_empty() { "The Ollama installer exited unsuccessfully".to_string() } else { details }));
        }

        if !ollama_command().arg("--version").output().map(|version| version.status.success()).unwrap_or(false) {
            return Err(AppError::Execution("Ollama was installed but could not be started. Restart agēntīq and run Free Mode setup again.".to_string()));
        }

        Ok(())
    }).await.map_err(|error| AppError::Execution(format!("Ollama installation task failed: {error}")))?;

    if result.is_ok() {
        let _ = app.emit("ollama_install_progress", serde_json::json!({ "stage": "complete", "message": "Ollama runtime installed" }));
    }
    result
}

#[tauri::command]
pub fn get_ram_gb() -> Result<f64, AppError> {
    let mut sys = System::new_all();
    sys.refresh_memory();
    let total_memory = sys.total_memory() as f64;
    let ram_gb = total_memory / 1_073_741_824.0;
    Ok(ram_gb)
}

#[tauri::command]
pub fn get_free_disk_gb() -> Result<f64, AppError> {
    let disks = Disks::new_with_refreshed_list();
    let mut total_free = 0u64;
    
    for disk in disks.list() {
        total_free += disk.available_space();
    }
    
    let free_gb = total_free as f64 / 1_073_741_824.0;
    Ok(free_gb)
}

#[tauri::command]
pub fn get_gpu_info() -> Result<String, AppError> {
    #[cfg(target_os = "macos")]
    {
        match Command::new("system_profiler")
            .arg("SPDisplaysDataType")
            .output()
        {
            Ok(output) => {
                let info = String::from_utf8_lossy(&output.stdout);
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
pub fn check_internet() -> Result<bool, AppError> {
    let mut command = Command::new("ping");
    #[cfg(target_os = "windows")]
    command.args(["-n", "1", "8.8.8.8"]);
    #[cfg(not(target_os = "windows"))]
    command.args(["-c", "1", "8.8.8.8"]);

    match command.output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn download_model(model_id: String, app: tauri::AppHandle) -> Result<(), AppError> {
    if !check_ollama()? {
        return Err(AppError::Config("Ollama is not installed yet".to_string()));
    }

    let model_app = app.clone();
    let model_name = model_id.clone();
    let _ = app.emit("download_progress", serde_json::json!({ "downloaded": 0, "total": 0, "speed": 0, "eta": 0, "status": "Starting Ollama model download" }));

    tokio::task::spawn_blocking(move || {
        ollama_command().args(["pull", &model_name]).output()
            .map_err(|error| AppError::Execution(format!("Could not start Ollama: {error}")))
    }).await.map_err(|error| AppError::Execution(format!("Model download task failed: {error}")))?
        .and_then(|output| {
            if output.status.success() {
                let _ = model_app.emit("download_progress", serde_json::json!({ "downloaded": 1, "total": 1, "speed": 0, "eta": 0, "status": "Model ready" }));
                Ok(())
            } else {
                let details = String::from_utf8_lossy(&output.stderr).trim().to_string();
                Err(AppError::Execution(if details.is_empty() { format!("Ollama could not download {model_id}") } else { details }))
            }
        })
}

#[tauri::command]
pub fn verify_model_checksum(model_id: String) -> Result<bool, AppError> {
    let output = ollama_command().args(["show", &model_id]).output();
    Ok(output.map(|result| result.status.success()).unwrap_or(false))
}
