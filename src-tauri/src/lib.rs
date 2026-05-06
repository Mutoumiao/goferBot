mod sidecar;

use sidecar::{emit_sidecar_ready, wait_for_port};
use std::sync::{Arc, Mutex};
use tauri::Manager;

pub struct SidecarHandle {
    pub port: Arc<Mutex<Option<u16>>>,
    pub shutdown_tx: Arc<Mutex<Option<tokio::sync::mpsc::Sender<()>>>>,
    pub monitor_join: Arc<Mutex<Option<std::thread::JoinHandle<()>>>>,
}

impl SidecarHandle {
    pub fn new() -> Self {
        Self {
            port: Arc::new(Mutex::new(None)),
            shutdown_tx: Arc::new(Mutex::new(None)),
            monitor_join: Arc::new(Mutex::new(None)),
        }
    }

    pub fn get_port(&self) -> Option<u16> {
        *self.port.lock().unwrap()
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_sidecar_port(state: tauri::State<Mutex<SidecarHandle>>) -> Result<u16, String> {
    state
        .lock()
        .unwrap()
        .get_port()
        .ok_or("Sidecar not ready".to_string())
}

#[tauri::command]
async fn restart_sidecar(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, Mutex<SidecarHandle>>,
) -> Result<(), String> {
    let tx = {
        let state = state.lock().unwrap();
        let tx = state.shutdown_tx.lock().unwrap().take();
        tx
    };
    if let Some(tx) = tx {
        let _ = tx.try_send(());
    }
    *state.lock().unwrap().port.lock().unwrap() = None;

    let join = {
        let state = state.lock().unwrap();
        let join = state.monitor_join.lock().unwrap().take();
        join
    };
    if let Some(join) = join {
        let _ = tokio::task::spawn_blocking(move || join.join()).await;
    }

    let port_file = sidecar::get_port_file_path(&app_handle)?;
    let _ = tokio::fs::remove_file(port_file).await;

    let (tx, rx) = tokio::sync::mpsc::channel(1);
    let join = sidecar::start_monitor_thread(app_handle.clone(), rx);
    {
        let h = state.lock().unwrap();
        *h.shutdown_tx.lock().unwrap() = Some(tx);
        *h.monitor_join.lock().unwrap() = Some(join);
    }

    let port = wait_for_port(&app_handle, 30).await?;
    {
        let h = state.lock().unwrap();
        *h.port.lock().unwrap() = Some(port);
    }
    emit_sidecar_ready(&app_handle, port);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(SidecarHandle::new()))
        .setup(|app| {
            let app_handle = app.handle().clone();

            let (tx, rx) = tokio::sync::mpsc::channel(1);
            let join = sidecar::start_monitor_thread(app_handle.clone(), rx);
            {
                let state: tauri::State<Mutex<SidecarHandle>> = app_handle.state();
                let h = state.lock().unwrap();
                *h.shutdown_tx.lock().unwrap() = Some(tx);
                *h.monitor_join.lock().unwrap() = Some(join);
            }

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_prevent_default::init())
        .invoke_handler(tauri::generate_handler![greet, get_sidecar_port, restart_sidecar])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
