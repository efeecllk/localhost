// src-tauri/src/commands.rs
// Tauri command handlers exposed to the frontend via invoke().

use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::errors::ScanError;
use crate::scanner::Scanner;
use crate::types::{ProjectGroup, Settings};

/// Convert ScanError to a user-facing string for the frontend.
fn to_cmd_error(e: ScanError) -> String {
    format!("{e}")
}

/// Main scanning command. Called every 5 seconds by the frontend poller
/// and on-demand for manual refresh.
#[tauri::command]
pub async fn get_processes(
    scanner: State<'_, Arc<Scanner>>,
    projects_dir: String,
) -> Result<Vec<ProjectGroup>, String> {
    scanner.scan(&projects_dir).await.map_err(to_cmd_error)
}

/// Kill a native process by PID.
/// On Unix, sends SIGTERM. On Windows, uses `taskkill`.
#[tauri::command]
pub async fn stop_process(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        std::process::Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to stop process {pid}: {e}"))?;
    }
    #[cfg(windows)]
    {
        std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .map_err(|e| format!("Failed to stop process {pid}: {e}"))?;
    }
    Ok(())
}

/// Restart a process: for MVP, this just kills the process.
/// Most dev tools (nodemon, cargo-watch) will auto-restart.
#[tauri::command]
pub async fn restart_process(pid: u32) -> Result<(), String> {
    stop_process(pid).await
}

/// Open a directory in the default terminal.
/// On macOS, opens Terminal.app. On Windows, opens cmd.exe.
/// On Linux, attempts to open the default terminal emulator via xdg-open.
#[tauri::command]
pub async fn open_in_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Terminal", &path])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", &format!("cd /d \"{}\"", path)])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        // Try common terminal emulators in order of preference
        let terminals = ["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"];
        let mut launched = false;
        for term in &terminals {
            if std::process::Command::new(term)
                .arg("--working-directory")
                .arg(&path)
                .spawn()
                .is_ok()
            {
                launched = true;
                break;
            }
        }
        if !launched {
            return Err(format!("Failed to open terminal in {path}: no supported terminal found"));
        }
    }
    Ok(())
}

/// Open a directory in the user's preferred editor.
#[tauri::command]
pub async fn open_in_editor(path: String, editor: String) -> Result<(), String> {
    let cmd = match editor.as_str() {
        "cursor" => "cursor",
        "code" | "vscode" => "code",
        "zed" => "zed",
        "subl" | "sublime" => "subl",
        other => other,
    };

    std::process::Command::new(cmd)
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open {path} with {editor}: {e}"))?;

    Ok(())
}

/// Open http://localhost:{port} in the default browser.
#[tauri::command]
pub async fn open_in_browser(port: u16) -> Result<(), String> {
    let url = format!("http://localhost:{port}");
    open::that(&url).map_err(|e| format!("Failed to open browser: {e}"))
}

/// Stop a Docker container by ID.
#[tauri::command]
pub async fn stop_docker_container(container_id: String) -> Result<(), String> {
    use bollard::container::StopContainerOptions;
    use bollard::Docker;

    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Docker connection failed: {e}"))?;

    docker
        .stop_container(&container_id, Some(StopContainerOptions { t: 10 }))
        .await
        .map_err(|e| format!("Failed to stop container: {e}"))
}

/// Restart a Docker container by ID.
#[tauri::command]
pub async fn restart_docker_container(container_id: String) -> Result<(), String> {
    use bollard::container::RestartContainerOptions;
    use bollard::Docker;

    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Docker connection failed: {e}"))?;

    docker
        .restart_container(&container_id, Some(RestartContainerOptions { t: 10 }))
        .await
        .map_err(|e| format!("Failed to restart container: {e}"))
}

/// Load settings from tauri-plugin-store.
#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    use tauri_plugin_store::StoreExt;

    let store = app
        .store("settings.json")
        .map_err(|e| format!("Failed to open settings store: {e}"))?;

    let settings = Settings {
        scan_interval: store
            .get("scan_interval")
            .and_then(|v| v.as_u64())
            .unwrap_or(5000) as u32,
        projects_dir: store
            .get("projects_dir")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| {
                dirs::home_dir()
                    .map(|h| format!("{}/Desktop/Projects", h.display()))
                    .unwrap_or_default()
            }),
        theme: store
            .get("theme")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "system".to_string()),
        editor_command: store
            .get("editor_command")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "cursor".to_string()),
    };

    Ok(settings)
}

/// Save settings to tauri-plugin-store.
#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    let store = app
        .store("settings.json")
        .map_err(|e| format!("Failed to open settings store: {e}"))?;

    store.set("scan_interval", serde_json::json!(settings.scan_interval));
    store.set("projects_dir", serde_json::json!(settings.projects_dir));
    store.set("theme", serde_json::json!(settings.theme));
    store.set(
        "editor_command",
        serde_json::json!(settings.editor_command),
    );

    store
        .save()
        .map_err(|e| format!("Failed to save settings: {e}"))
}
