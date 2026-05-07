# 架构说明（Architecture）

## 总体架构

本应用采用 Tauri v2 的经典 WebView + Rust 后端 + Node.js Sidecar 三层架构：

```
┌─────────────────────────────────────────┐
│           渲染进程（Renderer）            │
│      Vue 3 + Pinia + Tailwind CSS       │
│              src/                       │
├─────────────────────────────────────────┤
│      IPC（invoke / event listen）        │
├─────────────────────────────────────────┤
│           主进程（Main Process）          │
│              Rust                       │
│           src-tauri/src/                │
├─────────────────────────────────────────┤
│      Sidecar 进程（Node.js HTTP）         │
│           server/                       │
└─────────────────────────────────────────┘
```

- **渲染进程**：负责 UI 呈现与用户交互，通过 HTTP 直接访问 Sidecar 的 REST API。
- **主进程**：负责本地文件系统访问、Sidecar 子进程的生命周期管理（启动、监控、自动重启）。
- **Sidecar**：独立的 Node.js HTTP 服务，承载业务逻辑与数据持久化（SQLite），避免阻塞 Rust 主线程。

## 前端（`src/`）

| 文件/目录 | 职责 |
|-----------|------|
| `main.ts` | Vue 应用入口。创建应用实例、挂载 Pinia、连接 Vue Devtools（开发模式） |
| `App.vue` | 根组件。编排全局布局：`SplashScreen`、`SideBar`、`TabBar`、`ChatPage`；应用挂载时触发 `initSidecar()` |
| `stores/session.ts` | **会话状态中心**。管理标签页（tabs）、消息（messages）、发送状态；直接调用 Sidecar HTTP API |
| `stores/settings.ts` | 用户设置状态。管理 LLM 配置（provider、model、baseUrl、apiKey） |
| `composables/useSidecar.ts` | **Sidecar 生命周期管理**。通过 IPC 查询端口、监听 Rust 事件、管理超时、暴露重试能力 |
| `utils/sidecarClient.ts` | HTTP 客户端封装。Sidecar 端口管理、请求重试（3 次）、健康检查 |
| `utils/markdown.ts` | Markdown 解析与渲染工具 |
| `types/index.ts` | 全局类型定义：`Session`、`Message`、`LLMConfig`、`Tab`、`ChatRequest` |
| `components/ChatPage.vue` | 聊天页容器。根据当前 tab 状态切换 `EmptySession`、`ChatMessageList`、`ChatInput` |
| `components/ChatMessageList.vue` | 消息列表渲染 |
| `components/ChatMessage.vue` / `MarkdownRender.vue` | 单条消息与 Markdown 内容渲染 |
| `components/ChatInput.vue` | 用户输入框 |
| `components/SideBar.vue` | 左侧导航栏（首页、知识库、历史、设置） |
| `components/TabBar.vue` | 顶部标签页栏（切换、关闭、新建聊天） |
| `components/SplashScreen.vue` | 启动屏，等待 Sidecar 就绪 |
| `components/EmptySession.vue` | 空会话状态的快捷输入引导 |
| `assets/main.css` | Tailwind CSS 入口和全局样式变量 |

## 主进程（`src-tauri/src/`）

| 文件 | 职责 |
|------|------|
| `lib.rs` | Tauri 应用入口。注册命令、初始化 `SidecarHandle` 状态、启动 Sidecar 监控线程、加载插件 |
| `main.rs` | 薄透传层。仅调用 `tauri_app_lib::run()`，满足移动端构建要求 |
| `sidecar.rs` | **Sidecar 生命周期引擎**。启动 Node 子进程、探测可用端口、崩溃自动重启、向前端发射就绪事件 |

### 当前命令（Commands）

| 命令名 | 位置 | 功能 |
|--------|------|------|
| `get_sidecar_port` | `lib.rs` | 查询当前 Sidecar 监听端口；若未就绪返回错误 |
| `restart_sidecar` | `lib.rs` | 优雅关闭并重新启动 Sidecar 子进程 |

### 关键状态：`SidecarHandle`

- `port`: 当前 Sidecar 监听的端口
- `shutdown_tx` / `monitor_join`: 用于优雅重启的信号通道和监控线程句柄

### Sidecar 生命周期事件

- `sidecar-ready`：首次启动成功，携带 `{ port }`
- `sidecar-restarted`：崩溃后自动重启成功，携带 `{ port }`

## Sidecar（`server/`）

| 文件/目录 | 职责 |
|-----------|------|
| `index.ts` | Hono 服务入口。端口探测（默认 11451）、写入 `.sidecar-port`、路由挂载、健康检查 |
| `routes/chat.ts` | **聊天接口**。接收消息、保存用户消息、构建历史上下文、流式调用 LLM、持久化 assistant 回复 |
| `routes/sessions.ts` | 会话管理接口。会话的 CRUD、历史查询 |
| `services/llm.ts` | LLM 适配器。按 provider（openai / deepseek）拼接 API URL，解析 OpenAI 格式 SSE 流 |
| `db.ts` | SQLite 数据库初始化（`better-sqlite3`）。包含 `sessions` 和 `messages` 表 |
| `types.ts` | Sidecar 内部类型定义 |
| `utils.ts` | 工具函数（如获取 `APP_DATA_DIR`） |

### 数据库 Schema

**sessions**
- `id` TEXT PRIMARY KEY
- `title` TEXT NOT NULL
- `provider` TEXT, `model` TEXT
- `created_at` INTEGER, `updated_at` INTEGER
- `message_count` INTEGER DEFAULT 0

**messages**
- `id` TEXT PRIMARY KEY
- `session_id` TEXT NOT NULL（外键）
- `role` TEXT CHECK('user', 'assistant')
- `content` TEXT NOT NULL
- `created_at` INTEGER NOT NULL

## 数据目录

应用启动时由主进程初始化：

```
<userData>/knowledge-base/
├── docs/              # 导入的文档（Markdown、TXT 等）
├── sidecar.db         # SQLite 数据库（会话与消息）
├── .sidecar-port      # Sidecar 当前监听端口（供前端发现）
└── config.json        # 用户配置
```

## 依赖关系

- **前端 ↔ 主进程**：通过 `@tauri-apps/api/core` 的 `invoke` 调用命令；通过 `@tauri-apps/api/event` 的 `listen` 接收 Sidecar 状态事件
- **前端 ↔ Sidecar**：通过 `sidecarFetch()` 直接发起 HTTP 请求（`fetch`）
- **主进程 → Sidecar**：通过 `tokio::process::Command` 启动 Node 子进程，通过 `.sidecar-port` 文件同步端口
- **Sidecar → 本地文件系统**：直接读写 SQLite 和端口文件
- **Sidecar → 外部 API**：通过 `fetch` 调用 OpenAI / DeepSeek 等 LLM 服务

## 核心数据流：从"首页发消息"到"流式渲染"

```
用户输入 → ChatInput.vue
    ↓
ChatPage.vue 调用 sessionStore.sendMessage(content, settings.llmConfig)
    ↓
stores/session.ts
    ├─ 乐观更新：插入 user 消息到 messages Map
    ├─ sidecarFetch('/chat') → HTTP POST { message, sessionId, config }
    ↓
Sidecar (routes/chat.ts)
    ├─ 若新会话：INSERT INTO sessions
    ├─ INSERT INTO messages (user)
    ├─ SELECT 历史消息 → 构建 LLM context
    ├─ streamChatCompletion() → 向 LLM API 发起 SSE
    ├─ 逐 chunk 写入 SSE → 前端
    └─ 流结束后 INSERT INTO messages (assistant)
    ↓
stores/session.ts 解析 SSE
    ├─ 逐 chunk 追加到 assistant 消息 content
    ├─ 首次成功后将首页 tab "晋升"为正式会话 tab（绑定 sessionId）
    └─ 自动新建下一个首页 tab
    ↓
ChatMessageList.vue / MarkdownRender.vue 响应式渲染
```

## 领域状态关系

- **Tab（标签页）**：纯 UI 概念，有 `type: 'chat' | 'knowledgeBase' | 'history' | 'settings'`。`chat` 类型在首次发消息后被赋予 `sessionId`，完成"首页 → 正式会话"的晋升。
- **Session（会话）**：持久化在 SQLite 中，包含 `title`、`provider`、`model`、`message_count`。
- **Message（消息）**：与 Session 外键关联，支持 `user` / `assistant` 两种角色。
- **Sidecar 状态机**：`loading` → `ready` / `error`，由 Rust 监控线程驱动，前端通过 Tauri 事件监听。
