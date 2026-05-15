# Sidecar 启动与生命周期管理实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Tauri Rust 与 Node.js Hono Sidecar 的启动、发现和生命周期管理机制，使前端在 sidecar 就绪后才能调用 API。

**Architecture:** Rust 主进程在 setup 阶段 spawn Node.js sidecar 进程，sidecar 自发现可用端口并写入 `.sidecar-port` 文件，Rust 轮询该文件并做 HTTP health check，通过后通过 Tauri event 通知前端。前端使用全局状态管理 sidecar 就绪状态，在 ready 前显示 Splash Loading 遮罩。Sidecar 崩溃时 Rust 自动重启并广播新端口。

**Tech Stack:** Tauri v2 (Rust), Vue 3 + TypeScript + Pinia, Hono + @hono/node-server, Vitest

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `server/package.json` | Sidecar 依赖管理（Hono、TypeScript） |
| `server/tsconfig.json` | Sidecar TypeScript 编译配置 |
| `server/src/index.ts` | Hono 入口：端口自发现、`/health` 路由、`.sidecar-port` 文件写入 |
| `src-tauri/src/sidecar.rs` | Rust sidecar 进程启动、PID 监控、端口轮询、事件广播、自动重启 |
| `src/utils/sidecarClient.ts` | 前端 HTTP fetch 封装：自动感知端口、请求重试 |
| `src/composables/useSidecar.ts` | 前端 sidecar 全局状态：监听 Tauri event、超时检测、重试 IPC |
| `src/components/SplashScreen.vue` | 全屏 Loading 遮罩 + 超时错误页 + 重试按钮 |
| `tests/unit/utils/sidecarClient.test.ts` | `sidecarClient` 重试与端口管理单元测试 |
| `tests/unit/composables/useSidecar.test.ts` | `useSidecar` 状态机与事件监听单元测试 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `package.json` | 添加 `server:dev`、`server:build` 脚本 |
| `src-tauri/Cargo.toml` | 添加 `reqwest`、`tokio` 依赖 |
| `src-tauri/tauri.conf.json` | CSP `connect-src` 增加 `http://localhost:*` |
| `src-tauri/src/lib.rs` | 注册 IPC 命令、setup 中启动 sidecar、引入 `sidecar` 模块 |
| `src/App.vue` | 集成 `SplashScreen`，条件渲染主 UI |

---

## Task 1: 初始化 server/ 目录（Hono Sidecar 基础项目）

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`

- [ ] **Step 1: 创建 `server/package.json`**

```json
{
  "name": "knowledge-base-sidecar",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@hono/node-server": "^1.14.0",
    "hono": "^4.7.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.9.0"
  }
}
```

- [ ] **Step 2: 创建 `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 创建 `server/src/index.ts`**

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'

const DEFAULT_PORT = 11451
const MAX_PORT_ATTEMPTS = 100

function getAppDataDir(): string {
  const base = process.env.APP_DATA_DIR ?? os.homedir()
  const dir = path.join(base, 'knowledge-base')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function writePortFile(port: number): void {
  const portFile = path.join(getAppDataDir(), '.sidecar-port')
  fs.writeFileSync(portFile, String(port), 'utf-8')
}

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    function tryPort(port: number, attempts: number): void {
      if (attempts <= 0) {
        reject(new Error('No available port found'))
        return
      }
      const server = net.createServer()
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          tryPort(port + 1, attempts - 1)
        } else {
          reject(err)
        }
      })
      server.once('listening', () => {
        server.close(() => resolve(port))
      })
      server.listen(port, '127.0.0.1')
    }
    tryPort(startPort, MAX_PORT_ATTEMPTS)
  })
}

async function main(): Promise<void> {
  const port = await findAvailablePort(DEFAULT_PORT)
  writePortFile(port)

  const app = new Hono()

  app.get('/health', (c) => {
    return c.json({ status: 'ok' })
  })

  serve({
    fetch: app.fetch,
    port,
    hostname: '127.0.0.1',
  })

  console.log(`Sidecar running on http://127.0.0.1:${port}`)
}

main().catch((err) => {
  console.error('Failed to start sidecar:', err)
  process.exit(1)
})
```

- [ ] **Step 4: 安装 sidecar 依赖并编译**

Run:
```bash
cd server && pnpm install && pnpm build
```

Expected: `server/node_modules` 创建，`server/dist/index.js` 生成，无 TypeScript 编译错误。

- [ ] **Step 5: 独立验证 sidecar 能启动**

Run:
```bash
node server/dist/index.js
```

Expected 输出类似：
```
Sidecar running on http://127.0.0.1:11451
```

另开终端验证：
```bash
curl http://127.0.0.1:11451/health
```

Expected: `{"status":"ok"}`，且用户目录下 `knowledge-base/.sidecar-port` 文件内容为 `11451`。

Kill sidecar 进程后再继续下一步。

- [ ] **Step 6: Commit**

```bash
git add server/
git commit -m "feat(server): initialize Hono sidecar with port discovery and health check"
```

---

## Task 2: Rust 依赖与 Tauri 配置更新

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: 修改 `src-tauri/Cargo.toml` 添加依赖**

在 `[dependencies]` 段末尾追加：

```toml
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "json"] }
tokio = { version = "1", features = ["time", "process"] }
```

修改后的 `[dependencies]` 段应为：

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-prevent-default = "4.0"
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "json"] }
tokio = { version = "1", features = ["time", "process"] }
```

- [ ] **Step 2: 修改 `src-tauri/tauri.conf.json` CSP**

将 `app.security.csp.connect-src` 从：
```json
"connect-src": "ipc: http://ipc.localhost"
```

改为：
```json
"connect-src": "ipc: http://ipc.localhost http://localhost:*"
```

完整的 `app.security.csp` 段：

```json
"csp": {
  "default-src": "'self' customprotocol: asset:",
  "connect-src": "ipc: http://ipc.localhost http://localhost:*",
  "font-src": "'self",
  "img-src": "'self' asset: http://asset.localhost blob: data:",
  "style-src": "'unsafe-inline' 'self'"
}
```

- [ ] **Step 3: 编译验证**

Run:
```bash
pnpm check
```

Expected: `cargo check` 通过，无编译错误。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "feat(tauri): add reqwest/tokio deps and allow localhost CSP"
```

---

## Task 3: Rust Sidecar 启动与生命周期管理

**Files:**
- Create: `src-tauri/src/sidecar.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 创建 `src-tauri/src/sidecar.rs`**

```rust
use std::path::PathBuf;
use std::time::Duration;
use tokio::process::{Child, Command};
use tokio::sync::oneshot::channel;

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

pub fn spawn_sidecar(app_handle: &tauri::AppHandle) -> Result<Child, String> {
    let script = get_server_script_path(app_handle)?;
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

pub async fn monitor_child(
    app_handle: tauri::AppHandle,
    mut child: Child,
    mut shutdown_rx: tokio::sync::oneshot::Receiver<()>,
) {
    tokio::select! {
        status = child.wait() => {
            match status {
                Ok(s) if s.success() => {
                    println!("Sidecar exited normally");
                }
                _ => {
                    eprintln!("Sidecar crashed or exited with error");
                    let state: tauri::State<std::sync::Mutex<crate::SidecarHandle>> = app_handle.state();
                    {
                        let mut h = state.lock().unwrap();
                        *h.port.lock().unwrap() = None;
                    }

                    let _ = tokio::fs::remove_file(get_port_file_path(&app_handle)).await;
                    tokio::time::sleep(Duration::from_secs(2)).await;

                    match spawn_sidecar(&app_handle) {
                        Ok(new_child) => {
                            let (tx, rx) = channel();
                            {
                                let mut h = state.lock().unwrap();
                                *h.shutdown_tx.lock().unwrap() = Some(tx);
                            }

                            match wait_for_port(&app_handle, 30).await {
                                Ok(port) => {
                                    *state.lock().unwrap().port.lock().unwrap() = Some(port);
                                    emit_sidecar_restarted(&app_handle, port);
                                    tauri::async_runtime::spawn(monitor_child(
                                        app_handle,
                                        new_child,
                                        rx,
                                    ));
                                }
                                Err(e) => {
                                    eprintln!("Restarted sidecar failed to become ready: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to restart sidecar: {}", e);
                        }
                    }
                }
            }
        }
        _ = shutdown_rx => {
            let _ = child.kill().await;
            println!("Sidecar killed by restart request");
        }
    }
}
```

- [ ] **Step 2: 重写 `src-tauri/src/lib.rs`**

```rust
mod sidecar;

use sidecar::{emit_sidecar_ready, monitor_child, spawn_sidecar, wait_for_port};
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tokio::sync::oneshot::channel;

pub struct SidecarHandle {
    pub port: Arc<Mutex<Option<u16>>>,
    pub shutdown_tx: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
}

impl SidecarHandle {
    pub fn new() -> Self {
        Self {
            port: Arc::new(Mutex::new(None)),
            shutdown_tx: Arc::new(Mutex::new(None)),
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
    let tx = state.lock().unwrap().shutdown_tx.lock().unwrap().take();
    if let Some(tx) = tx {
        let _ = tx.send(());
    }
    *state.lock().unwrap().port.lock().unwrap() = None;

    let port_file = sidecar::get_port_file_path(&app_handle)?;
    let _ = tokio::fs::remove_file(port_file).await;

    let child = spawn_sidecar(&app_handle)?;
    let (tx, rx) = channel();
    {
        let mut h = state.lock().unwrap();
        *h.shutdown_tx.lock().unwrap() = Some(tx);
    }

    let port = wait_for_port(&app_handle, 30).await?;
    {
        let mut h = state.lock().unwrap();
        *h.port.lock().unwrap() = Some(port);
    }
    emit_sidecar_ready(&app_handle, port);

    tauri::async_runtime::spawn(monitor_child(app_handle, child, rx));

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(SidecarHandle::new()))
        .setup(|app| {
            let app_handle = app.handle().clone();

            let child = spawn_sidecar(&app_handle).map_err(|e| e.to_string())?;
            let (tx, rx) = channel();
            {
                let state: tauri::State<Mutex<SidecarHandle>> = app_handle.state();
                let mut h = state.lock().unwrap();
                *h.shutdown_tx.lock().unwrap() = Some(tx);
            }

            tauri::async_runtime::spawn(async move {
                match wait_for_port(&app_handle, 30).await {
                    Ok(port) => {
                        {
                            let state: tauri::State<Mutex<SidecarHandle>> = app_handle.state();
                            let mut h = state.lock().unwrap();
                            *h.port.lock().unwrap() = Some(port);
                        }
                        emit_sidecar_ready(&app_handle, port);
                    }
                    Err(e) => {
                        eprintln!("Sidecar failed to start: {}", e);
                    }
                }

                monitor_child(app_handle.clone(), child, rx).await;
            });

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
```

- [ ] **Step 3: 编译验证**

Run:
```bash
pnpm check
```

Expected: `cargo check` 通过。若出现 `unused_imports` 警告，属于正常（`greet` 命令后续可能移除，但现在保留）。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/
git commit -m "feat(rust): spawn sidecar, monitor lifecycle, emit ready/restarted events"
```

---

## Task 4: 前端 sidecarClient HTTP 封装

**Files:**
- Create: `src/utils/sidecarClient.ts`
- Create: `tests/unit/utils/sidecarClient.test.ts`

- [ ] **Step 1: 创建 `src/utils/sidecarClient.ts`**

```typescript
let currentPort: number | null = null

export function setSidecarPort(port: number): void {
  currentPort = port
}

export function getSidecarPort(): number | null {
  return currentPort
}

export function clearSidecarPort(): void {
  currentPort = null
}

export async function sidecarFetch(
  path: string,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  if (!currentPort) {
    throw new Error('Sidecar port not available')
  }

  const url = `http://127.0.0.1:${currentPort}${path}`

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.ok || i === retries) {
        return response
      }
    } catch (err) {
      if (i === retries) throw err
      await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    }
  }

  return fetch(url, options)
}

export async function healthCheck(): Promise<boolean> {
  if (!currentPort) return false
  try {
    const res = await fetch(`http://127.0.0.1:${currentPort}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
}
```

- [ ] **Step 2: 创建 `tests/unit/utils/sidecarClient.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sidecarFetch,
  setSidecarPort,
  getSidecarPort,
  clearSidecarPort,
  healthCheck,
} from '@/utils/sidecarClient'

describe('sidecarClient', () => {
  beforeEach(() => {
    setSidecarPort(11451)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('getSidecarPort returns current port', () => {
    expect(getSidecarPort()).toBe(11451)
  })

  it('should throw when port is not set', async () => {
    clearSidecarPort()
    await expect(sidecarFetch('/test')).rejects.toThrow('Sidecar port not available')
  })

  it('should fetch from correct URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response)

    await sidecarFetch('/health')
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:11451/health', {})
  })

  it('should retry on failure and eventually succeed', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true } as Response)

    const promise = sidecarFetch('/test', {}, 3)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(true)
  })

  it('should return last response when all retries exhausted', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)

    const result = await sidecarFetch('/test', {}, 1)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(false)
  })

  it('healthCheck returns true when sidecar responds', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response)
    const result = await healthCheck()
    expect(result).toBe(true)
  })

  it('healthCheck returns false when port is unset', async () => {
    clearSidecarPort()
    const result = await healthCheck()
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 3: 运行单元测试**

Run:
```bash
pnpm test tests/unit/utils/sidecarClient.test.ts
```

Expected: 6 tests passed, 0 failed.

- [ ] **Step 4: Commit**

```bash
git add src/utils/sidecarClient.ts tests/unit/utils/sidecarClient.test.ts
git commit -m "feat(client): add sidecarClient with retry logic and tests"
```

---

## Task 5: 前端 Sidecar 状态管理（useSidecar）

**Files:**
- Create: `src/composables/useSidecar.ts`
- Create: `tests/unit/composables/useSidecar.test.ts`

- [ ] **Step 1: 创建 `src/composables/useSidecar.ts`**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { ref } from 'vue'
import { setSidecarPort } from '@/utils/sidecarClient'

export type SidecarStatus = 'loading' | 'ready' | 'error'

export const sidecarStatus = ref<SidecarStatus>('loading')
export const sidecarPort = ref<number | null>(null)
export const sidecarError = ref<string>('')

let initDone = false
let timeoutId: ReturnType<typeof setTimeout> | null = null

function clearTimeoutIfAny(): void {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

export async function initSidecar(): Promise<void> {
  if (initDone) return
  initDone = true

  sidecarStatus.value = 'loading'
  sidecarError.value = ''

  try {
    const p = await invoke<number>('get_sidecar_port')
    setSidecarPort(p)
    sidecarPort.value = p
    sidecarStatus.value = 'ready'
    return
  } catch {
    // sidecar not ready yet, wait for events
  }

  await listen<{ port: number }>('sidecar-ready', (event) => {
    setSidecarPort(event.payload.port)
    sidecarPort.value = event.payload.port
    sidecarStatus.value = 'ready'
    clearTimeoutIfAny()
  })

  await listen<{ port: number }>('sidecar-restarted', (event) => {
    setSidecarPort(event.payload.port)
    sidecarPort.value = event.payload.port
    sidecarStatus.value = 'ready'
    clearTimeoutIfAny()
  })

  timeoutId = setTimeout(() => {
    if (sidecarStatus.value !== 'ready') {
      sidecarStatus.value = 'error'
      sidecarError.value = '服务启动超时，请检查日志或重启应用'
    }
  }, 30000)
}

export async function retrySidecar(): Promise<void> {
  clearTimeoutIfAny()
  sidecarStatus.value = 'loading'
  sidecarError.value = ''

  try {
    await invoke('restart_sidecar')
  } catch (e) {
    sidecarStatus.value = 'error'
    sidecarError.value = String(e)
  }
}

// Test helper only
export function _resetSidecarStateForTest(): void {
  initDone = false
  sidecarStatus.value = 'loading'
  sidecarPort.value = null
  sidecarError.value = ''
  clearTimeoutIfAny()
}
```

- [ ] **Step 2: 创建 `tests/unit/composables/useSidecar.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sidecarStatus,
  sidecarPort,
  sidecarError,
  initSidecar,
  retrySidecar,
  _resetSidecarStateForTest,
} from '@/composables/useSidecar'
import * as tauriApi from '@tauri-apps/api/core'
import * as tauriEvent from '@tauri-apps/api/event'

vi.mock('@tauri-apps/api/core')
vi.mock('@tauri-apps/api/event')

describe('useSidecar', () => {
  let readyCallback: ((payload: { port: number }) => void) | null = null
  let restartedCallback: ((payload: { port: number }) => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    _resetSidecarStateForTest()

    vi.mocked(tauriEvent.listen).mockImplementation(async (event, cb) => {
      if (event === 'sidecar-ready') {
        readyCallback = cb as unknown as (payload: { port: number }) => void
      }
      if (event === 'sidecar-restarted') {
        restartedCallback = cb as unknown as (payload: { port: number }) => void
      }
      return () => {}
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    readyCallback = null
    restartedCallback = null
  })

  it('should set ready when port is immediately available via invoke', async () => {
    vi.mocked(tauriApi.invoke).mockResolvedValue(11451)

    await initSidecar()

    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11451)
  })

  it('should remain loading until event fires', async () => {
    vi.mocked(tauriApi.invoke).mockRejectedValue(new Error('not ready'))

    await initSidecar()

    expect(sidecarStatus.value).toBe('loading')
  })

  it('should set error after 30s timeout', async () => {
    vi.mocked(tauriApi.invoke).mockRejectedValue(new Error('not ready'))

    await initSidecar()
    expect(sidecarStatus.value).toBe('loading')

    await vi.advanceTimersByTimeAsync(30000)

    expect(sidecarStatus.value).toBe('error')
    expect(sidecarError.value).toContain('超时')
  })

  it('should update to ready on sidecar-ready event', async () => {
    vi.mocked(tauriApi.invoke).mockRejectedValue(new Error('not ready'))

    await initSidecar()
    readyCallback?.({ port: 11452 })

    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11452)
  })

  it('should update port on sidecar-restarted event', async () => {
    vi.mocked(tauriApi.invoke).mockResolvedValue(11451)
    await initSidecar()
    expect(sidecarPort.value).toBe(11451)

    // Simulate a restart with new port
    restartedCallback?.({ port: 11453 })

    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11453)
  })

  it('should clear timeout when event arrives before 30s', async () => {
    vi.mocked(tauriApi.invoke).mockRejectedValue(new Error('not ready'))

    await initSidecar()
    await vi.advanceTimersByTimeAsync(15000)
    readyCallback?.({ port: 11452 })

    expect(sidecarStatus.value).toBe('ready')

    // Advance past original timeout
    await vi.advanceTimersByTimeAsync(20000)
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarError.value).toBe('')
  })

  it('retrySidecar should call restart_sidecar and reset to loading', async () => {
    vi.mocked(tauriApi.invoke).mockResolvedValue(11451)
    await initSidecar()
    sidecarStatus.value = 'error'

    vi.mocked(tauriApi.invoke).mockClear()
    vi.mocked(tauriApi.invoke).mockResolvedValue(undefined)

    await retrySidecar()

    expect(tauriApi.invoke).toHaveBeenCalledWith('restart_sidecar')
    expect(sidecarStatus.value).toBe('loading')
  })
})
```

- [ ] **Step 3: 运行单元测试**

Run:
```bash
pnpm test tests/unit/composables/useSidecar.test.ts
```

Expected: 7 tests passed, 0 failed.

- [ ] **Step 4: Commit**

```bash
git add src/composables/useSidecar.ts tests/unit/composables/useSidecar.test.ts
git commit -m "feat(composable): add useSidecar with event listeners, timeout, retry"
```

---

## Task 6: 前端 SplashScreen 组件与 App.vue 集成

**Files:**
- Create: `src/components/SplashScreen.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: 创建 `src/components/SplashScreen.vue`**

匹配项目深色主题（`bg-gray-800`, `text-gray-200`）。

```vue
<script setup lang="ts">
import { sidecarStatus, sidecarError, retrySidecar } from '@/composables/useSidecar'

async function handleRetry() {
  await retrySidecar()
}
</script>

<template>
  <div
    v-if="sidecarStatus !== 'ready'"
    class="fixed inset-0 z-50 flex items-center justify-center bg-gray-800"
  >
    <div class="text-center">
      <template v-if="sidecarStatus === 'loading'">
        <div
          class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-blue-400"
        ></div>
        <p class="text-gray-200">正在启动服务...</p>
      </template>
      <template v-else-if="sidecarStatus === 'error'">
        <div class="mb-4 text-red-400">
          <span class="icon-[mdi--alert-circle] text-4xl"></span>
        </div>
        <p class="mb-4 text-gray-200">{{ sidecarError || '服务启动失败' }}</p>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          @click="handleRetry"
        >
          重试
        </button>
      </template>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 重写 `src/App.vue`**

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import SplashScreen from './components/SplashScreen.vue'
import GreetComponent from './components/GreetComponent.vue'
import { initSidecar, sidecarStatus } from './composables/useSidecar'
import { useStore } from './store'

const store = useStore()

onMounted(() => {
  initSidecar()
})

// 当 sidecar ready 后初始化 store
watch(sidecarStatus, (s) => {
  if (s === 'ready') {
    store.initApp()
  }
})
</script>

<template>
  <SplashScreen />
  <main
    v-if="sidecarStatus === 'ready'"
    class="flex min-h-screen flex-1 flex-col items-center justify-center"
  >
    <h1>Welcome to Tauri 2 + Vue</h1>

    <div class="flex flex-row">
      <a href="https://vitejs.dev" target="_blank">
        <img src="/vite.svg" class="logo vite" alt="Vite logo" />
      </a>
      <a href="https://tauri.app" target="_blank">
        <img src="/tauri.svg" class="logo tauri" alt="Tauri logo" />
      </a>
      <a href="https://vuejs.org/" target="_blank">
        <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
      </a>
    </div>
    <p>Click on the Tauri, Vite, and Vue logos to learn more.</p>

    <GreetComponent />
  </main>
</template>
```

注意：`watch` 由 `unplugin-auto-import` 自动导入（已在 `vite.config.ts` 中配置 `vue` 导入）。

- [ ] **Step 3: 修改 `package.json` 添加 server 脚本**

在 `scripts` 段追加：

```json
"server:dev": "pnpm --dir server dev",
"server:build": "pnpm --dir server build"
```

- [ ] **Step 4: 编译验证**

Run:
```bash
pnpm type-check
```

Expected: 无 TypeScript 类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/components/SplashScreen.vue src/App.vue package.json
git commit -m "feat(ui): add SplashScreen with loading/error states, gate main UI on sidecar ready"
```

---

## Task 7: 端到端验证

**Files:** 不涉及文件变更，纯验证步骤。

- [ ] **Step 1: 确保 sidecar 已编译**

Run:
```bash
pnpm server:build
```

Expected: `server/dist/index.js` 存在且是最新版本。

- [ ] **Step 2: 启动 Tauri 开发模式**

Run:
```bash
pnpm tauri dev
```

Expected 行为：
1. Tauri 窗口打开，显示深色背景的全屏 Loading（"正在启动服务..."）和旋转动画。
2. 约 1-3 秒后，Loading 消失，显示 "Welcome to Tauri 2 + Vue" 主界面。
3. 终端中 Rust 输出类似 `Sidecar spawned...`（来自 sidecar stdout 的 node 进程输出，会在 Rust 的 stdout 中显示）。

- [ ] **Step 3: 验证 `get_sidecar_port` IPC**

在 Vue Devtools 控制台或浏览器 DevTools 中执行：
```javascript
const { invoke } = await import('@tauri-apps/api/core')
await invoke('get_sidecar_port')
```

Expected: 返回当前 sidecar 端口号（如 `11451`）。

- [ ] **Step 4: 验证崩溃自动重启**

找到 sidecar 的 Node 进程并 kill 掉（在任务管理器或终端中查找 `node server/dist/index.js`）。

Expected:
1. Rust 终端输出 `Sidecar crashed or exited with error`。
2. 约 2 秒后自动启动新 sidecar 进程（可能使用递增端口如 `11452`）。
3. 前端通过 `sidecar-restarted` event 收到新端口，UI 保持正常（无重新 Loading，因为状态已经是 ready）。
4. 再次调用 `invoke('get_sidecar_port')` 返回新端口。

- [ ] **Step 5: 验证超时和重试**

临时破坏 sidecar 启动：将 `server/dist/index.js` 改名为 `server/dist/index.js.bak`，然后点击前端"重试"按钮。

Expected:
1. 30 秒后前端显示错误页："服务启动超时，请检查日志或重启应用"。
2. 点击"重试"按钮，状态回到 Loading。
3. 30 秒后再次超时。
4. 恢复文件名后点击"重试"，约 1-3 秒后恢复正常。

- [ ] **Step 6: Commit（如有任何 dev 调试产生的变更则提交）**

如果验证过程中没有文件变更，跳过 commit。如有变更：

```bash
git add -A && git commit -m "chore: minor fixes from e2e validation"
```

---

## 自审检查

### 1. Spec 覆盖

对照 issue #01 acceptance criteria：

| Criteria | 实现位置 |
|----------|----------|
| Rust 成功启动 sidecar 进程，监控生命周期（PID 跟踪） | `src-tauri/src/sidecar.rs:spawn_sidecar()` + `monitor_child()` |
| sidecar 默认端口 11451，若被占用则自动递增，端口写入 `.sidecar-port` | `server/src/index.ts:findAvailablePort()` + `writePortFile()` |
| sidecar 提供 `GET /health` 路由返回 200 | `server/src/index.ts` Hono `/health` |
| Rust 暴露 `get_sidecar_port` IPC 命令给前端 | `src-tauri/src/lib.rs:get_sidecar_port` |
| Rust 通过 Tauri event `sidecar-ready` 和 `sidecar-restarted` 向前端广播端口 | `src-tauri/src/sidecar.rs:emit_sidecar_ready()` + `emit_sidecar_restarted()` |
| 前端实现 `sidecarClient` 封装 fetch，自动处理端口变更和请求重试 | `src/utils/sidecarClient.ts:sidecarFetch()` + `setSidecarPort()` |
| 前端在收到 `sidecar-ready` 前显示 Splash Loading 遮罩，不渲染主 UI | `src/components/SplashScreen.vue` + `src/App.vue` 条件渲染 |
| 30 秒超时后前端显示错误页，提供"重试"按钮调用 Rust IPC 重新启动 sidecar | `src/composables/useSidecar.ts:initSidecar()` timeout + `retrySidecar()` + `restart_sidecar` command |
| `tauri.conf.json` CSP 允许 `http://localhost:*` | `src-tauri/tauri.conf.json:connect-src` |
| `server/` 目录初始化，Hono 基础项目搭建（TypeScript、路由、中间件） | `server/package.json` + `server/tsconfig.json` + `server/src/index.ts` |

**无遗漏。**

### 2. Placeholder 扫描

- [x] 无 "TBD"/"TODO"/"implement later"/"fill in details"
- [x] 无 "Add appropriate error handling" 等模糊描述
- [x] 无 "Write tests for the above"（已附具体测试代码）
- [x] 无 "Similar to Task N" 引用
- [x] 每个代码步骤都包含完整可复制的代码

### 3. 类型一致性

| 接口 | 定义位置 | 使用位置 | 一致？ |
|------|----------|----------|--------|
| `sidecar-ready` payload | `src-tauri/src/sidecar.rs`: `{ port: u16 }` | `src/composables/useSidecar.ts`: `listen<{ port: number }>` | ✅ |
| `sidecar-restarted` payload | `src-tauri/src/sidecar.rs`: `{ port: u16 }` | `src/composables/useSidecar.ts`: `listen<{ port: number }>` | ✅ |
| `get_sidecar_port` 返回值 | `src-tauri/src/lib.rs`: `Result<u16, String>` | `src/composables/useSidecar.ts`: `invoke<number>()` | ✅ |
| `restart_sidecar` | `src-tauri/src/lib.rs`: `async fn -> Result<(), String>` | `src/composables/useSidecar.ts`: `invoke('restart_sidecar')` | ✅ |
| `.sidecar-port` 文件 | `server/src/index.ts`: 写入 `String(port)` | `src-tauri/src/sidecar.rs`: `parse::<u16>()` | ✅ |
| `sidecarFetch` 端口来源 | `src/utils/sidecarClient.ts`: `currentPort` | `src/composables/useSidecar.ts`: `setSidecarPort()` 设置 | ✅ |

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-sidecar-startup.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — 我按 Task 逐个 dispatch 新鲜 subagent，每 Task 完成后 review，快速迭代。

**2. Inline Execution** — 在当前 session 中使用 `executing-plans` skill 批量执行，中间设 checkpoint 供 review。

**Which approach?**
