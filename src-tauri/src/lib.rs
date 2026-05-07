mod sidecar;

use sidecar::{emit_sidecar_ready, wait_for_port};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tokio::sync::Mutex;

pub struct SidecarHandle {
    pub port: Option<u16>,
    pub shutdown_tx: Option<tokio::sync::mpsc::Sender<()>>,
    pub monitor_join: Option<std::thread::JoinHandle<()>>,
}

impl SidecarHandle {
    pub fn new() -> Self {
        Self {
            port: None,
            shutdown_tx: None,
            monitor_join: None,
        }
    }

    pub fn get_port(&self) -> Option<u16> {
        self.port
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_sidecar_port(state: tauri::State<'_, Mutex<SidecarHandle>>) -> Result<u16, String> {
    state
        .lock()
        .await
        .get_port()
        .ok_or("Sidecar not ready".to_string())
}

#[tauri::command]
async fn restart_sidecar(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, Mutex<SidecarHandle>>,
) -> Result<(), String> {
    let tx = {
        let mut state = state.lock().await;
        state.shutdown_tx.take()
    };
    if let Some(tx) = tx {
        let _ = tx.try_send(());
    }
    {
        let mut state = state.lock().await;
        state.port = None;
    }

    let join = {
        let mut state = state.lock().await;
        state.monitor_join.take()
    };
    if let Some(join) = join {
        let _ = tokio::task::spawn_blocking(move || join.join()).await;
    }

    let port_file = sidecar::get_port_file_path(&app_handle)?;
    let _ = tokio::fs::remove_file(port_file).await;
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    let (tx, rx) = tokio::sync::mpsc::channel(1);
    let join = sidecar::start_monitor_thread(app_handle.clone(), rx);
    {
        let mut h = state.lock().await;
        h.shutdown_tx = Some(tx);
        h.monitor_join = Some(join);
    }

    let port = wait_for_port(&app_handle, 30).await?;
    {
        let mut h = state.lock().await;
        h.port = Some(port);
    }
    emit_sidecar_ready(&app_handle, port);

    Ok(())
}

use serde_json::json;
use std::fs;

#[tauri::command]
async fn import_files(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<SidecarHandle>>,
    knowledge_base_id: String,
    target_path: String,
) -> Result<usize, String> {
    let port = state
        .lock()
        .await
        .get_port()
        .ok_or("Sidecar not ready".to_string())?;

    // 打开系统文件对话框（多选）
    let file_paths = app
        .dialog()
        .file()
        .add_filter("Text Documents", &["txt", "md", "markdown"])
        .blocking_pick_files();

    let mut paths: Vec<std::path::PathBuf> = Vec::new();
    if let Some(p) = file_paths {
        for f in p {
            if let Some(path) = f.as_path() {
                paths.push(path.to_path_buf());
            }
        }
    }

    if paths.is_empty() {
        return Ok(0);
    }

    let client = reqwest::Client::new();
    let url = format!(
        "http://127.0.0.1:{}/knowledge-bases/{}/files",
        port, knowledge_base_id
    );

    let mut imported = 0;

    for file_path in paths {
        let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
        let file_name = file_path
            .file_name()
            .ok_or("Invalid file path".to_string())?
            .to_string_lossy()
            .to_string();

        let payload = json!({
            "path": target_path,
            "files": [{ "name": file_name, "content": content }]
        });

        client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        imported += 1;
    }

    Ok(imported)
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
                let mut h = state.blocking_lock();
                h.shutdown_tx = Some(tx);
                h.monitor_join = Some(join);
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
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_sidecar_port,
            restart_sidecar,
            import_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
