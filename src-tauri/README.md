# src-tauri / Tauri v2 桌面壳层

## 状态：冻结开发（Frozen）

> **自 2026-05-16 起，本目录进入全面冻结状态。**
> 除非收到明确的"解冻并开发 Tauri 相关功能"指令，否则任何 Agent 不得修改本目录下的任何文件。

---

## 前因后果

### 曾经做什么（V1 架构）

本项目最初定位为**本地桌面应用**：

- **Tauri Rust 后端** 负责窗口管理、系统对话框、本地文件系统访问
- **Sidecar Node 进程**（`packages/server/`）作为本地后端服务，由 Tauri 启动并监控生命周期
- **SQLite + 本地文件夹** 存储所有数据
- 前端通过 `shellAdapters` + `backendAdapters` 中转层与 Sidecar 通信

`src-tauri/` 在此架构中的核心职责：

| 文件              | 职责                                                 |
|-------------------|------------------------------------------------------|
| `src/lib.rs`      | Tauri 应用入口，管理 SidecarHandle 状态              |
| `src/sidecar.rs`  | Sidecar 进程管理：启动、端口发现、健康监控、自动重启 |
| `src/main.rs`     | 二进制入口，调用 lib                                 |
| `Cargo.toml`      | Rust 依赖（tauri、tokio、reqwest、dialog 插件等）    |
| `tauri.conf.json` | Tauri 配置：窗口、CSP、构建钩子、图标                |

关键 Sidecar 机制：
- Tauri 启动时 `spawn_sidecar()` 启动 Node 进程
- Sidecar 将 HTTP 端口写入 `.sidecar-port` 文件
- Tauri 轮询端口文件 + `/health` 端点确认就绪
- 就绪后发射 `sidecar-ready` 事件，前端据此启用 UI
- Sidecar 崩溃时自动重启，发射 `sidecar-restarted` 事件

### 为什么改变（架构决策 ADR-0004）

项目从"本地桌面应用"全面转向**"云端优先的 SaaS 型 Web 应用"**：

| 维度     | V1（旧）                     | V2（新）                     |
|----------|------------------------------|------------------------------|
| 部署模式 | Tauri 打包桌面应用           | Web + 独立 Server            |
| 数据库   | SQLite 本地文件              | PostgreSQL（Docker）         |
| 文件存储 | 本地物理文件夹               | MinIO 对象存储（Docker）     |
| 向量检索 | sqlite-vec 本地扩展          | Milvus（Docker）             |
| 认证     | 无                           | Better Auth + Session Cookie |
| 前端通信 | Tauri IPC → Sidecar 端口发现 | 直接 HTTP `fetch` 到 Server  |

**根本原因**：
1. 物理文件夹无法支持远程同步、分享、协作
2. sqlite-vec 无法支撑大规模向量检索
3. 同步索引阻塞主流程
4. 文件流经过后端，带宽压力大
5. SaaS 化和团队协作是长期目标

### 现在变成什么

- **主路线**：传统 Web 应用（浏览器/Vite dev server + Hono Server）
- **Tauri 角色**：从"核心运行时"降级为"可选的本地增强包"
- **Server 角色**：从"Tauri 的 Sidecar"升级为"独立 Web Server"

### Tauri 的未来（Phase 6+）

当 Web 应用功能完整后，Tauri 可能作为**可选扩展**重新启用：

- 提供桌面级体验（原生窗口、系统托盘、快捷键）
- 本地文件系统访问（导入本地文件夹到 MinIO）
- 本地 AI 模型直连（Ollama 等）
- 离线模式支持（本地 SQLite 缓存层）

但这一切的前提是：
1. Web 应用功能 100% 完整且稳定
2. 有明确的本地增强需求
3. 收到明确的"解冻 Tauri"指令

---

## 当前影响

### 已删除/废弃的 V1 机制

| V1 机制                         | 状态       | V2 替代方案                            |
|---------------------------------|------------|----------------------------------------|
| `packages/shellAdapters/`       | **待删除** | 直接 `fetch`                           |
| `packages/backendAdapters/`     | **待删除** | 直接 `fetch` 或薄封装 `apiClient`      |
| `useSidecarStatus` composable   | **待删除** | 删除，Server 健康由部署层保障          |
| `SplashScreen.vue` Sidecar 等待 | **待删除** | 删除，应用直接启动                     |
| Sidecar 端口发现                | **已废弃** | Server 使用固定端口（`PORT` 环境变量） |
| `.sidecar-port` 文件            | **已废弃** | 不再使用                               |
| `syncKnowledgeBasesFromDisk`    | **已废弃** | 虚拟文件夹（数据库树结构）             |
| sqlite-vec / FTS5               | **已废弃** | Milvus 向量检索                        |

### 保留但冻结的文件

本目录下所有文件**保留在 git 中**但**停止开发**：

- `src/lib.rs`
- `src/sidecar.rs`
- `src/main.rs`
- `Cargo.toml`
- `tauri.conf.json`
- `icons/`
- `capabilities/`

---

## Agent 操作规范

### 禁止做的事

- 修改 `src-tauri/` 下的任何源代码
- 修改 `Cargo.toml` 依赖
- 修改 `tauri.conf.json` 配置
- 在 issue/plan 中安排 Tauri 相关任务
- 将 Tauri 作为当前开发的依赖或前提条件

### 允许做的事

- 阅读本 README 了解历史背景
- 在文档中引用 Tauri 作为"未来扩展方向"
- 在 ADR 中讨论 Tauri 相关决策（仅规划层面）

### 解冻条件

只有当用户明确说以下类似话语时，才允许修改本目录：

> "请重新启用 Tauri 桌面壳层"
> "需要添加 Tauri 本地增强功能"
> "解冻 src-tauri 目录"

---

## 相关文档

- [ADR-0004: 云原生架构重构](../docs/adrs/0004-cloud-native-rearchitecture.md)
- [PRD v2: 云原生产品需求](../docs/prd/v2-cloud-native.md)
- [开发流程](../docs/guide/workflow.md)

---

*最后更新：2026-05-16*
*冻结起始日期：2026-05-16*
*解冻需经：用户明确授权*
