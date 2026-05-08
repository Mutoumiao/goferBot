# Issue #01 — Sidecar 启动与生命周期管理 测试用例

**对应 Issue**: `.scratch/knowledge-base/issues/01-sidecar-startup.md`  
**状态**: closed  
**测试框架**: Vitest（前端 Unit）、Rust 集成测试（待补充）

---

## 1.1 Rust 后端 — Sidecar 进程管理

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-01-001 | Sidecar 脚本路径解析（开发环境） | `CARGO_MANIFEST_DIR` 已设置，`server/dist/index.js` 存在 | 调用 `get_server_script_path` | 返回 dev_path（相对于 manifest 的 `server/dist/index.js`） |
| TC-01-002 | Sidecar 脚本路径解析（生产环境） | `resource_dir/server/dist/index.js` 存在 | 调用 `get_server_script_path` | 返回 prod_path |
| TC-01-003 | Sidecar 脚本路径解析（文件缺失） | 两处路径均不存在 | 调用 `get_server_script_path` | 返回包含两个尝试路径的错误信息 |
| TC-01-004 | 启动 sidecar 进程 | 脚本路径有效 | 调用 `spawn_sidecar` | 成功返回 `tokio::process::Child`，PID 有效，stdout/stderr 被 piped |
| TC-01-005 | 应用数据目录创建 | 首次启动 | 调用 `get_kb_dir` | 创建 `app_data_dir/knowledge-base/` 目录并返回其 PathBuf |
| TC-01-006 | 端口文件路径 | 应用数据目录已就绪 | 调用 `get_port_file_path` | 返回 `{app_data}/knowledge-base/.sidecar-port` |

## 1.2 Rust 后端 — 端口发现与健康检查

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-01-007 | 等待端口文件出现（正常） | Sidecar 已启动并写入 `.sidecar-port`，`GET /health` 返回 200 | 调用 `wait_for_port(app, 30)` | 在超时前返回端口号（u16） |
| TC-01-008 | 等待端口超时 | `.sidecar-port` 不存在或 health 持续失败 | 调用 `wait_for_port(app, 1)` | 返回错误 `"Timeout waiting for sidecar port"` |
| TC-01-009 | 端口文件内容无效 | `.sidecar-port` 内容为非数字字符串 | 调用 `wait_for_port` | 返回错误 `"Invalid port in .sidecar-port"` |
| TC-01-010 | 端口文件读取失败 | 文件存在但无读取权限（模拟） | 调用 `wait_for_port` | 返回对应的 IO 错误信息 |

## 1.3 Rust 后端 — 事件广播与 IPC

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-01-011 | 广播 sidecar-ready | AppHandle 有效 | 调用 `emit_sidecar_ready(app, 11451)` | 前端收到 `sidecar-ready` 事件，payload `{ port: 11451 }` |
| TC-01-012 | 广播 sidecar-restarted | AppHandle 有效 | 调用 `emit_sidecar_restarted(app, 11452)` | 前端收到 `sidecar-restarted` 事件，payload `{ port: 11452 }` |
| TC-01-013 | IPC `get_sidecar_port` | sidecar 已就绪，state 中 port = 11451 | 前端调用 `invoke('get_sidecar_port')` | 返回 `11451` |
| TC-01-014 | IPC `restart_sidecar` | monitor_loop 正在运行 | 前端调用 `invoke('restart_sidecar')` | 发送 shutdown 信号，旧进程被 kill，monitor_loop 重新 spawn sidecar |

## 1.4 Rust 后端 — 监控循环（monitor_loop）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-01-015 | 正常启动流程 | 首次启动 | monitor_loop 执行 | 先 emit `sidecar-ready`，崩溃后 emit `sidecar-restarted`，端口递增 |
| TC-01-016 | Sidecar 崩溃自动重启 | 当前 sidecar 运行中，手动 kill | 等待子进程退出 | monitor_loop 检测到退出，清除 port 文件，等待 2s 后重新 spawn，递增端口 |
| TC-01-017 | 连续 spawn 失败退避 | sidecar 脚本持续不可执行 | monitor_loop 重试 | 前 5 次间隔 5s，超过 5 次后间隔 60s |
| TC-01-018 | Graceful shutdown | 调用 `restart_sidecar` | 发送 shutdown 信号 | 当前 child 被 kill，monitor_loop 不退出而是重新 spawn |

## 1.5 前端 — useSidecar Composable

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-01-019 | 立即就绪（invoke 成功） | `invoke('get_sidecar_port')` 返回 11451 | 调用 `initSidecar()` | `sidecarStatus = 'ready'`，`sidecarPort = 11451` |
| TC-01-020 | 等待事件就绪 | invoke 失败，之后收到 `sidecar-ready` | 调用 `initSidecar()`，触发事件 | 初始 `loading`，事件后变为 `ready`，端口正确 |
| TC-01-021 | 30 秒超时错误 | invoke 失败，事件永不触发 | 调用 `initSidecar()`，推进 30000ms | `sidecarStatus = 'error'`，`sidecarError` 包含"超时" |
| TC-01-022 | 超时前事件到达 | invoke 失败，15000ms 后事件到达 | 推进 15000ms 后触发事件 | `sidecarStatus = 'ready'`，再推进 20000ms 仍为 `ready` |
| TC-01-023 | sidecar-restarted 更新端口 | 已就绪于 11451，之后收到 restarted 11453 | 触发 restarted 事件 | `sidecarStatus` 保持 `ready`，`sidecarPort = 11453` |
| TC-01-024 | 重复初始化幂等 | `initSidecar()` 已执行过一次 | 再次调用 `initSidecar()` | 内部逻辑不重复执行，状态不变 |
| TC-01-025 | retrySidecar 重试 | 当前状态为 error | 调用 `retrySidecar()` | 调用 `invoke('restart_sidecar')`，状态重置为 `loading` |
| TC-01-026 | 事件监听权限异常 | `listen()` 抛出权限错误 | 调用 `initSidecar()` | `sidecarStatus = 'error'`，错误信息提示权限配置 |

**已有自动化测试**: `tests/unit/composables/useSidecar.test.ts`  
**覆盖范围**: TC-01-019 ~ TC-01-026（全部覆盖）

## 1.6 前端 — sidecarClient 工具

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-01-027 | 端口未设置时抛错 | `clearSidecarPort()` | 调用 `sidecarFetch('/test')` | 抛出 `'Sidecar port not available'` |
| TC-01-028 | 正确构造请求 URL | `setSidecarPort(11451)` | 调用 `sidecarFetch('/health')` | `fetch` 被调用，URL 为 `http://127.0.0.1:11451/health` |
| TC-01-029 | 请求失败重试后成功 | 首次 fetch 抛 Network error，第二次成功 | 调用 `sidecarFetch('/test', {}, 3)` | 共调用 2 次 fetch，返回成功的 Response |
| TC-01-030 | 重试次数耗尽返回最后响应 | fetch 始终返回 500 | 调用 `sidecarFetch('/test', {}, 1)` | 调用 2 次 fetch，返回最后一次的 500 Response |
| TC-01-031 | healthCheck 成功 | sidecar 端口已设置，/health 返回 200 | 调用 `healthCheck()` | 返回 `true` |
| TC-01-032 | healthCheck 端口未设置 | `clearSidecarPort()` | 调用 `healthCheck()` | 返回 `false` |
| TC-01-033 | healthCheck 超时 | sidecar 无响应 | 调用 `healthCheck()` | 返回 `false`（AbortSignal 2s 超时） |

**已有自动化测试**: `tests/unit/utils/sidecarClient.test.ts`  
**覆盖范围**: TC-01-027 ~ TC-01-033（全部覆盖）

---

## 待补充的自动化测试

| TC-ID 范围 | 测试层 | 建议方案 |
|---|---|---|
| TC-01-001 ~ TC-01-006 | Rust 单元/集成 | 为 `sidecar.rs` 添加 Rust 测试，mock `AppHandle` 或提取纯函数测试 |
| TC-01-007 ~ TC-01-010 | Rust 集成 | 使用临时目录 + mock HTTP server 测试 `wait_for_port` |
| TC-01-011 ~ TC-01-014 | Rust + Tauri | 通过 Tauri 测试工具或手动验证事件/IPC |
| TC-01-015 ~ TC-01-018 | Rust 集成 | 模拟 Child process 行为，验证 monitor_loop 状态机 |

---

*文档生成日期：2026-05-08*  
*对应 Issue：#01-sidecar-startup*
