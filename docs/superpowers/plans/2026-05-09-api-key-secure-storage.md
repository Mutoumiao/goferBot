# API Key 安全存储 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `config.json` 中的 API Key 从明文存储迁移至 Tauri `safe_storage` OS 级加密存储，并通过环境变量注入使 Sidecar 独立进程仍能获取密钥。

**Architecture:** Rust 主进程提供 Tauri IPC 命令（`store_api_key` / `retrieve_api_key`），使用 `safe_storage` 将密钥加密后持久化到应用数据目录的 `secrets/` 下。启动 Sidecar 时，Rust 解密所有密钥并通过环境变量（`KB_APIKEY_*`）注入。Sidecar 的 `loadConfig` 从环境变量补全 apiKey，确保后台任务（索引、Embedding）无需前端介入即可调用外部 API。前端 `settingsStore` 在 save/load 时通过 IPC 管理密钥，并自动在 apiKey 变更后重启 Sidecar 以刷新环境变量。

**Tech Stack:** Tauri v2 (Rust, safe_storage), TypeScript, Node.js, Hono, Pinia

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src-tauri/src/secrets.rs` | 新建 | Rust 安全存储核心：加密写入、解密读取、明文迁移 |
| `src-tauri/src/sidecar.rs` | 修改 | `spawn_sidecar` 注入 `env_vars` 中的环境变量 |
| `src-tauri/src/lib.rs` | 修改 | 注册 IPC 命令、启动前迁移明文密钥、准备环境变量 |
| `server/src/lib/secrets.ts` | 新建 | Sidecar 从 `KB_APIKEY_*` 环境变量读取 apiKey |
| `server/src/routes/settings.ts` | 修改 | `loadConfig` 从环境变量补全 apiKey；`saveConfig` 磁盘只存脱敏配置；删除 TODO |
| `src/stores/settings.ts` | 修改 | 调用 IPC 存取密钥、发送脱敏配置、apiKey 变更后自动重启 Sidecar |

---

### Task 1: Rust secrets 模块

**Files:**
- Create: `src-tauri/src/secrets.rs`
- Modify: `src-tauri/src/lib.rs`（顶部添加 `mod secrets;`）

**Context:** Tauri 2.0 的 `Manager` trait 提供 `safe_storage()` 方法，返回 `SafeStorage`，其 `encrypt/decrypt` 使用 OS 原生加密（Windows DPAPI / macOS Keychain / Linux Secret Service）。加密后的二进制数据由我们自己管理文件存储。

- [ ] **Step 1: 创建 `src-tauri/src/secrets.rs`**

```rust
use std::collections::HashMap;
use tauri::Manager;

fn get_secrets_dir(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let kb_dir = crate::sidecar::get_kb_dir(app_handle)?;
    let secrets_dir = kb_dir.join("secrets");
    std::fs::create_dir_all(&secrets_dir).map_err(|e| e.to_string())?;
    Ok(secrets_dir)
}

pub fn store_api_key(app_handle: &tauri::AppHandle, provider: &str, key: &str) -> Result<(), String> {
    let safe = app_handle.safe_storage();
    let encrypted = safe.encrypt(key.as_bytes()).map_err(|e| e.to_string())?;
    let file_path = get_secrets_dir(app_handle)?.join(format!("{}.bin", provider));
    std::fs::write(&file_path, encrypted).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn retrieve_api_key(app_handle: &tauri::AppHandle, provider: &str) -> Result<String, String> {
    let file_path = get_secrets_dir(app_handle)?.join(format!("{}.bin", provider));
    if !file_path.exists() {
        return Ok(String::new());
    }
    let encrypted = std::fs::read(&file_path).map_err(|e| e.to_string())?;
    let safe = app_handle.safe_storage();
    let decrypted = safe.decrypt(&encrypted).map_err(|e| e.to_string())?;
    String::from_utf8(decrypted).map_err(|e| e.to_string())
}

pub fn get_all_api_keys(app_handle: &tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let secrets_dir = get_secrets_dir(app_handle)?;
    let mut result = HashMap::new();
    if !secrets_dir.exists() {
        return Ok(result);
    }
    let entries = std::fs::read_dir(&secrets_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if let Some(ext) = path.extension() {
            if ext == "bin" {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    let key = retrieve_api_key(app_handle, stem)?;
                    if !key.is_empty() {
                        result.insert(stem.to_string(), key);
                    }
                }
            }
        }
    }
    Ok(result)
}

pub fn migrate_plaintext_keys(app_handle: &tauri::AppHandle) -> Result<bool, String> {
    let kb_dir = crate::sidecar::get_kb_dir(app_handle)?;
    let config_path = kb_dir.join("config.json");
    if !config_path.exists() {
        return Ok(false);
    }
    let raw = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let mut json: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    let mut migrated = false;

    if let Some(providers) = json.get_mut("providers").and_then(|v| v.as_object_mut()) {
        for (provider, cfg) in providers {
            if let Some(key) = cfg.get("apiKey").and_then(|v| v.as_str()) {
                if !key.is_empty() {
                    store_api_key(app_handle, provider, key)?;
                    if let Some(obj) = cfg.as_object_mut() {
                        obj.insert("apiKey".to_string(), serde_json::Value::String("".to_string()));
                    }
                    migrated = true;
                }
            }
        }
    }

    if let Some(emb) = json.get_mut("embeddingProvider").and_then(|v| v.as_object_mut()) {
        if let Some(key) = emb.get("apiKey").and_then(|v| v.as_str()) {
            if !key.is_empty() {
                store_api_key(app_handle, "embedding", key)?;
                emb.insert("apiKey".to_string(), serde_json::Value::String("".to_string()));
                migrated = true;
            }
        }
    }

    if migrated {
        std::fs::write(&config_path, serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    }

    Ok(migrated)
}
```

- [ ] **Step 2: 在 `src-tauri/src/lib.rs` 顶部注册模块**

修改 `src-tauri/src/lib.rs`，在 `mod sidecar;` 下方新增：

```rust
mod secrets;
```

- [ ] **Step 3: 编译验证 Rust 侧**

Run: `pnpm check`
Expected: `cargo check` 通过，无编译错误。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/secrets.rs src-tauri/src/lib.rs
git commit -m "feat(#05b): Rust safeStorage 加密模块与明文迁移逻辑"
```

---

### Task 2: Sidecar 启动支持环境变量注入

**Files:**
- Modify: `src-tauri/src/lib.rs`（`SidecarHandle` struct）
- Modify: `src-tauri/src/sidecar.rs`（`spawn_sidecar`）
- Modify: `src-tauri/src/lib.rs`（`restart_sidecar` 命令）

**Context:** `spawn_sidecar` 当前只注入 `APP_DATA_DIR`。需要扩展为同时注入 `SidecarHandle.env_vars` 中的 `KB_APIKEY_*`。`restart_sidecar` 需在重启前重新读取 secrets 并更新环境变量，确保 apiKey 修改后生效。

- [ ] **Step 1: `SidecarHandle` 新增 `env_vars` 字段**

修改 `src-tauri/src/lib.rs` 中的 `SidecarHandle`：

```rust
pub struct SidecarHandle {
    pub port: Option<u16>,
    pub shutdown_tx: Option<tokio::sync::mpsc::Sender<()>>,
    pub monitor_join: Option<std::thread::JoinHandle<()>>,
    pub env_vars: std::collections::HashMap<String, String>,
}

impl SidecarHandle {
    pub fn new() -> Self {
        Self {
            port: None,
            shutdown_tx: None,
            monitor_join: None,
            env_vars: std::collections::HashMap::new(),
        }
    }
    // ... get_port 不变 ...
}
```

- [ ] **Step 2: `spawn_sidecar` 注入环境变量**

修改 `src-tauri/src/sidecar.rs` 的 `spawn_sidecar` 函数：

```rust
pub fn spawn_sidecar(app_handle: &tauri::AppHandle) -> Result<tokio::process::Child, String> {
    let script = get_server_script_path(app_handle)?;
    println!("[sidecar] Starting sidecar from: {}", script.display());
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;

    let mut cmd = Command::new("node");
    cmd.arg(script)
        .env("APP_DATA_DIR", app_data_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let state: tauri::State<tokio::sync::Mutex<crate::SidecarHandle>> = app_handle.state();
    if let Ok(handle) = state.blocking_lock() {
        for (k, v) in &handle.env_vars {
            cmd.env(k, v);
        }
    }

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn sidecar: {}", e))?;
    Ok(child)
}
```

- [ ] **Step 3: `restart_sidecar` 重新读取 secrets**

修改 `src-tauri/src/lib.rs` 的 `restart_sidecar` 命令。在创建新的 monitor 线程前，重新读取 secrets 并构建环境变量：

```rust
#[tauri::command]
async fn restart_sidecar(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, Mutex<SidecarHandle>>,
) -> Result<(), String> {
    // ---- 保留原有 shutdown 逻辑 ----
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
    // ---- shutdown 逻辑结束 ----

    // 重新读取 secrets 并构建环境变量
    let env_vars = {
        let api_keys = crate::secrets::get_all_api_keys(&app_handle).unwrap_or_default();
        let mut vars = std::collections::HashMap::new();
        for (provider, key) in api_keys {
            vars.insert(format!("KB_APIKEY_{}", provider.to_uppercase()), key);
        }
        vars
    };

    let (tx, rx) = tokio::sync::mpsc::channel(1);
    let join = sidecar::start_monitor_thread(app_handle.clone(), rx);
    {
        let mut h = state.lock().await;
        h.shutdown_tx = Some(tx);
        h.monitor_join = Some(join);
        h.env_vars = env_vars;
    }

    let port = sidecar::wait_for_port(&app_handle, 30).await?;
    {
        let mut h = state.lock().await;
        h.port = Some(port);
    }
    sidecar::emit_sidecar_ready(&app_handle, port);

    Ok(())
}
```

- [ ] **Step 4: 编译验证**

Run: `pnpm check`
Expected: `cargo check` 通过。

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/sidecar.rs
git commit -m "feat(#05b): Sidecar 启动支持 KB_APIKEY_* 环境变量注入"
```

---

### Task 3: Tauri 命令注册与启动集成

**Files:**
- Modify: `src-tauri/src/lib.rs`（新增命令、setup 闭包、invoke_handler）

**Context:** 注册 `store_api_key` 和 `retrieve_api_key` 两个 Tauri 命令供前端调用。在 `setup` 闭包中首次启动 Sidecar 前，执行明文迁移并准备环境变量。

- [ ] **Step 1: 新增两个 Tauri 命令**

在 `src-tauri/src/lib.rs` 中，`restart_sidecar` 命令之后、`run` 函数之前，添加：

```rust
#[tauri::command]
fn store_api_key(app_handle: tauri::AppHandle, provider: String, key: String) -> Result<(), String> {
    crate::secrets::store_api_key(&app_handle, &provider, &key)
}

#[tauri::command]
fn retrieve_api_key(app_handle: tauri::AppHandle, provider: String) -> Result<String, String> {
    crate::secrets::retrieve_api_key(&app_handle, &provider)
}
```

- [ ] **Step 2: 修改 `setup` 闭包，集成迁移与环境变量注入**

将 `src-tauri/src/lib.rs` 中的 `setup` 闭包替换为：

```rust
.setup(|app| {
    let app_handle = app.handle().clone();

    // 1. 迁移明文 apiKey（如有）到 safeStorage
    let _ = crate::secrets::migrate_plaintext_keys(&app_handle);

    // 2. 准备环境变量用于 Sidecar 注入
    let api_keys = crate::secrets::get_all_api_keys(&app_handle).unwrap_or_default();
    let mut env_vars = std::collections::HashMap::new();
    for (provider, key) in api_keys {
        env_vars.insert(format!("KB_APIKEY_{}", provider.to_uppercase()), key);
    }

    let (tx, rx) = tokio::sync::mpsc::channel(1);
    let join = sidecar::start_monitor_thread(app_handle.clone(), rx);
    {
        let state: tauri::State<Mutex<SidecarHandle>> = app_handle.state();
        let mut h = state.blocking_lock();
        h.shutdown_tx = Some(tx);
        h.monitor_join = Some(join);
        h.env_vars = env_vars;
    }

    #[cfg(debug_assertions)]
    {
        let window = app.get_webview_window("main").unwrap();
        window.open_devtools();
    }
    Ok(())
})
```

- [ ] **Step 3: 将新命令注册到 `invoke_handler`**

修改 `.invoke_handler(...)` 调用，添加两个新命令：

```rust
.invoke_handler(tauri::generate_handler![
    greet,
    get_sidecar_port,
    restart_sidecar,
    import_files,
    store_api_key,
    retrieve_api_key,
])
```

- [ ] **Step 4: 编译验证**

Run: `pnpm check`
Expected: `cargo check` 通过，无编译错误。

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(#05b): 注册 store/retrieve_api_key IPC 命令，启动前自动迁移明文密钥"
```

---

### Task 4: Sidecar 环境变量配置补全

**Files:**
- Create: `server/src/lib/secrets.ts`
- Modify: `server/src/routes/settings.ts`

**Context:** Sidecar 作为独立 Node.js 进程，启动时通过环境变量获得 apiKey。`loadConfig` 在读取 `config.json` 后，从 `KB_APIKEY_*` 环境变量补全 apiKey；`saveConfig` 始终将 apiKey 字段置空后落盘，确保磁盘上无明文密钥。

- [ ] **Step 1: 创建 `server/src/lib/secrets.ts`**

```typescript
export function getApiKeyFromEnv(provider: string): string | undefined {
  const envKey = `KB_APIKEY_${provider.toUpperCase()}`
  return process.env[envKey]
}
```

- [ ] **Step 2: 修改 `server/src/routes/settings.ts`**

首先将文件顶部的导入修改为：

```typescript
import { Hono } from 'hono'
import fs from 'node:fs'
import path from 'node:path'
import { getAppDataDir } from '../utils.js'
import { getApiKeyFromEnv } from '../lib/secrets.js'
import type { AppConfig } from '../types.js'
```

然后替换 `loadConfig` 和 `saveConfig`：

```typescript
function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    const cfg: AppConfig = {
      ...DEFAULT_CONFIG,
      ...parsed,
      providers: { ...DEFAULT_CONFIG.providers, ...parsed.providers },
    }
    // 从环境变量补全 apiKey（优先于磁盘中的空字符串）
    cfg.providers.openai.apiKey = getApiKeyFromEnv('openai') || cfg.providers.openai.apiKey
    cfg.providers.claude.apiKey = getApiKeyFromEnv('claude') || cfg.providers.claude.apiKey
    cfg.providers.deepseek.apiKey = getApiKeyFromEnv('deepseek') || cfg.providers.deepseek.apiKey
    cfg.providers.custom.apiKey = getApiKeyFromEnv('custom') || cfg.providers.custom.apiKey
    cfg.embeddingProvider.apiKey = getApiKeyFromEnv('embedding') || cfg.embeddingProvider.apiKey
    return cfg
  } catch {
    return DEFAULT_CONFIG
  }
}

function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  // 磁盘只存储脱敏配置，apiKey 字段始终置空
  const sanitized: AppConfig = JSON.parse(JSON.stringify(config))
  sanitized.providers.openai.apiKey = ''
  sanitized.providers.claude.apiKey = ''
  sanitized.providers.deepseek.apiKey = ''
  sanitized.providers.custom.apiKey = ''
  sanitized.embeddingProvider.apiKey = ''
  fs.writeFileSync(configPath, JSON.stringify(sanitized, null, 2), 'utf-8')
}
```

同时删除原文件中第 40-41 行的 TODO 注释。

- [ ] **Step 3: 构建 Sidecar 并验证**

Run: `cd server && pnpm build`
Expected: `tsc` 编译通过，无类型错误。

- [ ] **Step 4: Commit**

```bash
git add server/src/lib/secrets.ts server/src/routes/settings.ts
git commit -m "feat(#05b): Sidecar 从环境变量补全 apiKey，磁盘仅存储脱敏配置"
```

---

### Task 5: 前端 settings store 集成 safeStorage

**Files:**
- Modify: `src/stores/settings.ts`

**Context:** 前端通过 `@tauri-apps/api/core` 的 `invoke` 调用 Rust IPC 命令。`loadConfig` 从 Sidecar 获取脱敏配置后，通过 `retrieve_api_key` 回填每个 provider 的 apiKey。`saveConfig` 先将变更的 apiKey 通过 `store_api_key` 写入 safeStorage，再发送脱敏配置给 Sidecar；若 apiKey 发生变更，自动调用 `restart_sidecar` 刷新环境变量。

- [ ] **Step 1: 导入 `invoke`**

在 `src/stores/settings.ts` 顶部新增导入：

```typescript
import { invoke } from '@tauri-apps/api/core'
```

- [ ] **Step 2: 重写 `loadConfig` 函数**

```typescript
async function loadConfig() {
  isLoading.value = true
  try {
    const res = await sidecarFetch('/settings')
    if (res.ok) {
      const data = await res.json()
      const cfg: AppConfig = {
        ...DEFAULT_CONFIG,
        ...data,
        providers: { ...DEFAULT_CONFIG.providers, ...data.providers },
      }

      // 从 Tauri safeStorage 回填 apiKey
      const providersToRestore = ['openai', 'claude', 'deepseek', 'custom'] as const
      for (const provider of providersToRestore) {
        try {
          const key = (await invoke('retrieve_api_key', { provider })) as string
          if (key) cfg.providers[provider].apiKey = key
        } catch {
          // safeStorage 中无此密钥，保持空字符串
        }
      }
      try {
        const embKey = (await invoke('retrieve_api_key', { provider: 'embedding' })) as string
        if (embKey) cfg.embeddingProvider.apiKey = embKey
      } catch {
        // ignore
      }

      config.value = cfg
    }
  } finally {
    isLoading.value = false
  }
}
```

- [ ] **Step 3: 重写 `saveConfig` 函数**

```typescript
async function saveConfig(updates: Partial<AppConfig>) {
  const newConfig = {
    ...config.value,
    ...updates,
    providers: updates.providers
      ? { ...config.value.providers, ...updates.providers }
      : config.value.providers,
    embeddingProvider: updates.embeddingProvider
      ? { ...config.value.embeddingProvider, ...updates.embeddingProvider }
      : config.value.embeddingProvider,
  } as AppConfig

  let apiKeyChanged = false
  const providersToStore = ['openai', 'claude', 'deepseek', 'custom'] as const

  for (const provider of providersToStore) {
    const oldKey = config.value.providers[provider].apiKey
    const newKey = newConfig.providers[provider].apiKey
    if (newKey !== oldKey) {
      await invoke('store_api_key', { provider, key: newKey })
      apiKeyChanged = true
    }
  }

  const oldEmbKey = config.value.embeddingProvider.apiKey
  const newEmbKey = newConfig.embeddingProvider.apiKey
  if (newEmbKey !== oldEmbKey) {
    await invoke('store_api_key', { provider: 'embedding', key: newEmbKey })
    apiKeyChanged = true
  }

  // 发送脱敏配置（apiKey 置空）
  const sanitized: AppConfig = JSON.parse(JSON.stringify(newConfig))
  for (const provider of providersToStore) {
    sanitized.providers[provider].apiKey = ''
  }
  sanitized.embeddingProvider.apiKey = ''

  const res = await sidecarFetch('/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sanitized),
  })

  if (res.ok) {
    config.value = newConfig
    if (apiKeyChanged) {
      await invoke('restart_sidecar')
    }
  }
}
```

- [ ] **Step 4: TypeScript 类型检查**

Run: `pnpm type-check`
Expected: 无类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/stores/settings.ts
git commit -m "feat(#05b): 前端 settings store 集成 safeStorage IPC，apiKey 变更自动重启 Sidecar"
```

---

### Task 6: 测试验证与清理

**Files:**
- Modify: `.scratch/knowledge-base/issues/05b-api-key-secure-storage.md`（验收标准打勾）

- [ ] **Step 1: 运行前端单元测试**

Run: `pnpm test`
Expected: 全部测试通过（当前基线 38 files, 254 tests）。

- [ ] **Step 2: 运行 TypeScript 类型检查**

Run: `pnpm type-check`
Expected: 无类型错误。

- [ ] **Step 3: 运行 Rust 检查**

Run: `pnpm check`
Expected: `cargo check` 通过。

- [ ] **Step 4: 验证 TODO 已删除**

确认 `server/src/routes/settings.ts` 中第 40-41 行的 TODO 注释已删除。

- [ ] **Step 5: 更新 Issue 文件状态**

修改 `.scratch/knowledge-base/issues/05b-api-key-secure-storage.md`：

```markdown
Status: closed
```

并将验收标准全部标记为完成：

```markdown
- [x] Sidecar 写入配置时，将所有 `apiKey` 字段提取并加密存入 OS keychain（或 Tauri safeStorage），`config.json` 中仅保留占位符或空字符串
- [x] Sidecar 读取配置时，自动从 keychain 解密并回填 apiKey 字段
- [x] 前端 SettingsPage 保持现有 UI 不变（用户无感知）
- [x] 迁移：首次启动时检测到明文 apiKey，自动迁移至 safeStorage 并清空 config.json 中的明文
- [x] Windows / macOS / Linux 三平台兼容（Tauri v2 safeStorage）
- [x] 关闭本 issue 后删除 `server/src/routes/settings.ts` 中的 TODO 注释
```

- [ ] **Step 6: Commit**

```bash
git add .scratch/knowledge-base/issues/05b-api-key-secure-storage.md
git commit -m "docs(#05b): 标记 Issue 完成，更新验收状态"
```

---

## Self-Review

### 1. Spec coverage

Issue #05b 验收标准对照：

| 验收标准 | 对应任务 |
|---------|---------|
| Sidecar 写入配置时提取 apiKey 加密存储，`config.json` 仅保留占位符 | Task 4 (`saveConfig` 置空 apiKey) + Task 5 (前端发送脱敏配置) |
| Sidecar 读取配置时自动解密回填 apiKey | Task 4 (`loadConfig` 从环境变量补全) |
| 前端 SettingsPage 保持现有 UI 不变 | Task 5 (仅修改 store，UI 无改动) |
| 首次启动检测到明文 apiKey 自动迁移 | Task 1 (`migrate_plaintext_keys`) + Task 3 (setup 中调用) |
| Windows / macOS / Linux 三平台兼容 | Task 1 (Tauri v2 safeStorage 原生支持三平台) |
| 关闭后删除 TODO 注释 | Task 4 (删除 TODO) |

**无遗漏。**

### 2. Placeholder scan

- 无 "TBD" / "TODO" / "implement later" / "fill in details"
- 无 "Add appropriate error handling" 等模糊描述
- 每个代码步骤均包含可直接复制粘贴的完整代码
- 无 "Similar to Task N" 引用

### 3. Type consistency

- `AppConfig` / `ChatProviderConfig` / `EmbeddingProviderConfig` 类型前后端一致，未引入新字段或修改结构
- `store_api_key` / `retrieve_api_key` 的 IPC 签名在 Rust (Task 3) 和前端 (Task 5) 中一致：`provider: String`, `key: String`
- 环境变量命名规则一致：`KB_APIKEY_{PROVIDER}`，Rust 侧（Task 3）和 Sidecar 侧（Task 4）均使用 `provider.toUppercase()`

---

*Plan written by writing-plans skill. Last reviewed: 2026-05-09.*
