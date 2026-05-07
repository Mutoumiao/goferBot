use std::path::PathBuf;
use std::time::Duration;
use tauri::{Emitter, Manager};
use tokio::process::Command;

pub fn get_kb_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let kb_dir = app_data.join("knowledge-base");
    std::fs::create_dir_all(&kb_dir).map_err(|e| e.to_string())?;
    Ok(kb_dir)
}

pub fn get_port_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(get_kb_dir(app_handle)?.join(".sidecar-port"))
}

fn get_server_script_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app_handle.path().resource_dir().map_err(|e| e.to_string())?;
    let prod_path = resource_dir.join("server").join("dist").join("index.js");
    if prod_path.exists() {
        return Ok(prod_path);
    }

    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
        .map_err(|_| "CARGO_MANIFEST_DIR not set".to_string())?;
    let dev_path = PathBuf::from(manifest_dir)
        .parent()
        .ok_or("Cannot get parent of manifest dir")?
        .join("server")
        .join("dist")
        .join("index.js");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err(format!(
        "Sidecar script not found. Tried: {}, {}",
        prod_path.display(),
        dev_path.display()
    ))
}

pub fn spawn_sidecar(app_handle: &tauri::AppHandle) -> Result<tokio::process::Child, String> {
    let script = get_server_script_path(app_handle)?;
    println!("[sidecar] Starting sidecar from: {}", script.display());
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;

    let child = Command::new("node")
        .arg(script)
        .env("APP_DATA_DIR", app_data_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    Ok(child)
}

pub async fn wait_for_port(
    app_handle: &tauri::AppHandle,
    timeout_secs: u64,
) -> Result<u16, String> {
    let port_file = get_port_file_path(app_handle)?;
    let start = std::time::Instant::now();

    loop {
        if start.elapsed() > Duration::from_secs(timeout_secs) {
            return Err("Timeout waiting for sidecar port".to_string());
        }

        if port_file.exists() {
            let content = tokio::fs::read_to_string(&port_file)
                .await
                .map_err(|e| e.to_string())?;
            let port: u16 = content
                .trim()
                .parse()
                .map_err(|_| "Invalid port in .sidecar-port".to_string())?;

            let url = format!("http://127.0.0.1:{}/health", port);
            match reqwest::get(&url).await {
                Ok(resp) if resp.status().is_success() => return Ok(port),
                _ => {}
            }
        }

        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}

pub fn emit_sidecar_ready(app_handle: &tauri::AppHandle, port: u16) {
    let _ = app_handle.emit("sidecar-ready", serde_json::json!({ "port": port }));
}

pub fn emit_sidecar_restarted(app_handle: &tauri::AppHandle, port: u16) {
    let _ = app_handle.emit("sidecar-restarted", serde_json::json!({ "port": port }));
}

async fn monitor_loop(
    app_handle: tauri::AppHandle,
    shutdown_rx: &mut tokio::sync::mpsc::Receiver<()>,
) {
    let mut is_restart = false;
    let mut spawn_failures = 0u32;

    loop {
        let mut child = match spawn_sidecar(&app_handle) {
            Ok(c) => {
                spawn_failures = 0;
                c
            }
            Err(e) => {
                spawn_failures += 1;
                eprintln!("Failed to spawn sidecar: {}", e);
                let delay = if spawn_failures > 5 {
                    Duration::from_secs(60)
                } else {
                    Duration::from_secs(5)
                };
                tokio::time::sleep(delay).await;
                continue;
            }
        };

        match wait_for_port(&app_handle, 30).await {
            Ok(port) => {
                {
                    let state: tauri::State<tokio::sync::Mutex<crate::SidecarHandle>> =
                        app_handle.state();
                    let mut handle = state.lock().await;
                    handle.port = Some(port);
                }
                if is_restart {
                    emit_sidecar_restarted(&app_handle, port);
                } else {
                    emit_sidecar_ready(&app_handle, port);
                }
            }
            Err(e) => {
                eprintln!("Sidecar failed to become ready: {}", e);
                let _ = child.kill().await;
                tokio::time::sleep(Duration::from_secs(5)).await;
                continue;
            }
        }

        tokio::select! {
            status = child.wait() => {
                match status {
                    Ok(s) if s.success() => {
                        println!("Sidecar exited normally");
                    }
                    _ => {
                        eprintln!("Sidecar crashed or exited with error");
                    }
                }

                {
                    let state: tauri::State<tokio::sync::Mutex<crate::SidecarHandle>> =
                        app_handle.state();
                    let mut handle = state.lock().await;
                    handle.port = None;
                }

                if let Ok(port_file) = get_port_file_path(&app_handle) {
                    let _ = tokio::fs::remove_file(port_file).await;
                }
                tokio::time::sleep(Duration::from_secs(2)).await;
                is_restart = true;
                continue;
            }
            _ = shutdown_rx.recv() => {
                let _ = child.kill().await;
                println!("Sidecar killed by restart request");
                return;
            }
        }
    }
}

pub fn start_monitor_thread(
    app_handle: tauri::AppHandle,
    mut shutdown_rx: tokio::sync::mpsc::Receiver<()>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to create tokio runtime for sidecar monitor");
        rt.block_on(monitor_loop(app_handle, &mut shutdown_rx));
    })
}
