Status: needs-triage

## What to build

建立 Tauri Rust 与 Node.js Hono Sidecar 的启动、发现和生命周期管理机制，使前端能够在 sidecar 就绪后开始调用 API。

端到端行为：用户启动应用 → Tauri 窗口显示 → 前端展示 Splash Loading（"正在启动服务..."）→ Rust 启动 sidecar Node 进程 → sidecar 启动 Hono 服务、初始化 SQLite → sidecar 将监听端口写入 `.sidecar-port` → Rust 通过 Tauri event `sidecar-ready` 携带端口通知前端 → 前端 `sidecarClient` 收到端口后解除 Loading，渲染完整 Vue UI。若 30 秒内未就绪，前端显示错误页并提供"重试"按钮。若 sidecar 崩溃，Rust 自动重启（递增端口）并通过 `sidecar-restarted` event 通知前端更新端口。

## Acceptance criteria

- [ ] Rust 成功启动 sidecar 进程，监控其生命周期（PID 跟踪）
- [ ] sidecar 默认端口 11451，若被占用则自动递增，端口写入 `.sidecar-port`
- [ ] sidecar 提供 `GET /health` 路由返回 200
- [ ] Rust 暴露 `get_sidecar_port` IPC 命令给前端
- [ ] Rust 通过 Tauri event `sidecar-ready` 和 `sidecar-restarted` 向前端广播端口
- [ ] 前端实现 `sidecarClient` 封装 fetch，自动处理端口变更和请求重试
- [ ] 前端在收到 `sidecar-ready` 前显示 Splash Loading 遮罩，不渲染主 UI
- [ ] 30 秒超时后前端显示错误页，提供"重试"按钮调用 Rust IPC 重新启动 sidecar
- [ ] `tauri.conf.json` CSP 允许 `http://localhost:*`
- [ ] `server/` 目录初始化，Hono 基础项目搭建（TypeScript、路由、中间件）

## Blocked by

None - can start immediately.

## Comments
