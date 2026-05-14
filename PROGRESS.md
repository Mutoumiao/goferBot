# 项目进度追踪（Progress）

本文档记录 Knowledge Base 应用所有 Issue 的执行进度与后续开发计划。

> **更新日期**：2026-05-14  
> **对应 Issue 目录**：`.scratch/knowledge-base/issues/`

---

## 进度概览

| 阶段 | Issue | 状态 | 说明 |
|------|-------|------|------|
| 基础设施 | #01 Sidecar 启动 | closed | Tauri ↔ Node.js Sidecar 启动、发现、生命周期管理 |
| 核心功能 | #02 基础对话 | closed | SSE 流式问答、会话标签管理、消息存储 |
| 核心功能 | #03 知识库管理 | closed | CRUD、文件导入、资源管理器、回收站 |
| 增强功能 | #03b 右键菜单与文件操作 | closed | 置顶、修改资料、新建文件夹、重命名、移动/复制、回收站页面 |
| 核心功能 | #04 RAG 索引检索 | closed | sqlite-vec + FTS5 混合搜索、索引队列、`@提及` 交互 |
| 索引同步 | #04b 文件操作后索引同步 | closed | 跨库移动/复制/重命名后的 document_chunks 同步 |
| 配置系统 | #05 多提供商设置 | closed | 设置页、多 LLM 配置、Embedding 配置、温度参数、每会话模型切换 |

| 历史管理 | #06 对话历史 | closed | 历史列表、恢复会话、删除、重命名 |
| 本地模型 | #07 Ollama 与错误处理 | closed | Ollama 本地模型、全局错误处理、Loading/空状态 |
| 质量保障 | #08 测试覆盖 | closed | 45 个测试文件、297 条用例全部通过，覆盖率阈值 lines≥70 branches≥55 functions≥60 statements≥70 |
| 质量保障 | #09 端到端测试 | closed | 三阶测试体系全部搭建完成：阶1 E2E 28条、阶2 集成34条、阶3 验收3条。40+手动场景全部自动化 |
| 架构重构 | #10 Shell 抽象与浏览器模式 | closed | 提取 Shell 模块解耦前端与 Tauri，使 Web 可在浏览器独立运行 |
| 架构重构 | #11 BackendTransport 统一 | closed | 统一 HTTP 通信模块，将 sidecarClient 浅模块深化为高 leverage 接口 |

---

## 已完成

### #01 Sidecar 启动与生命周期管理

- **状态**：`closed`  
- **文件**：`.scratch/knowledge-base/issues/01-sidecar-startup.md`  
- **验收标准**：全部达成  
- **关键交付**：
  - Rust `sidecar.rs`：进程启动、端口发现、健康检查、崩溃自动重启
  - Tauri IPC：`get_sidecar_port`、`restart_sidecar`
  - Tauri Events：`sidecar-ready`、`sidecar-restarted`
  - 前端 `useSidecar` composable + Splash Loading + 超时错误 + 重试
  - 前端 `sidecarClient`：自动端口感知、请求重试
  - `server/` Hono 项目初始化，`GET /health`

### #02 基础问答对话功能

- **状态**：`closed`  
- **文件**：`.scratch/knowledge-base/issues/02-basic-chat.md`  
- **验收标准**：全部达成  
- **关键交付**：
  - SQLite Schema：`sessions`、`messages` 表
  - Sidecar API：`POST /chat`（SSE）、`GET /sessions`、`GET /sessions/:id`
  - 前端空会话态（大输入框 + 快捷胶囊）与对话态（底部输入框 + 消息流）
  - Markdown 渲染 + 代码语法高亮 + 复制按钮
  - Pinia `useSessionStore`：首页占位符自动升格、多标签管理
  - 浏览器式标签栏：新建/切换/关闭，单例页面标签限制

### #03 知识库 CRUD 管理与文件导入

- **状态**：`closed`  
- **文件**：`.scratch/knowledge-base/issues/03-knowledge-base-management.md`  
- **验收标准**：全部达成  
- **关键交付**：
  - SQLite Schema：`knowledge_bases` 表
  - Sidecar API：知识库 CRUD（GET/POST/DELETE/restore）、文件列表、导入、搜索
  - 前端知识库管理页：左侧列表 + 右侧资源管理器视图
  - 文件导入链路：前端 IPC → Rust 对话框读取 → HTTP POST → Sidecar 保存
  - 资源管理器：双击文件夹进入、面包屑导航、搜索
  - 面包屑回退/前进：维护导航历史栈（browse + search 状态）
  - 回收站机制：物理移动至 `.trash/`、恢复、同名冲突重命名为"-副本"

### #03b 知识库右键菜单与文件操作

- **状态**：`closed`
- **文件**：`.scratch/knowledge-base/issues/03b-kb-context-menus-and-file-operations.md`
- **验收标准**：全部达成
- **关键交付**：
  - 数据库 Schema 变更：`knowledge_bases` 表增加 `is_pinned`、`sort_order`、`icon` 字段
  - Sidecar API：`PATCH /knowledge-bases/:id`、`POST /:id/folders`、`PATCH /:id/files/:path`、`POST /move`、`POST /copy`、`GET /deleted`
  - 前端组件：`ContextMenu.vue`、`InlineRename.vue`、`EditKbDialog.vue`、`MoveCopyDialog.vue`、`RecycleBinPage.vue`
  - 知识库列表右键：置顶 toggle、修改资料弹窗、移入回收站
  - 文件区域右键：新建文件夹、重命名、移动/复制、永久删除
  - 移动/复制弹窗：左栏知识库列表 + 右栏文件夹列表 + 面包屑导航
  - 回收站页面：已删除知识库列表 + 恢复操作

### #04 RAG 索引检索

- **状态**：`closed`
- **文件**：`.scratch/knowledge-base/issues/04-rag-indexing-retrieval.md`
- **验收标准**：全部达成
- **关键交付**：
  - SQLite Schema：`document_chunks` 表 + `vec_document_chunks`（sqlite-vec HNSW）+ `fts_document_chunks`（FTS5）
  - Sidecar 启动时加载 sqlite-vec 扩展，自动创建虚拟表
  - 后台索引队列：文件导入后自动入队，LangChain `TextLoader` + `RecursiveCharacterTextSplitter` 分块
  - Embedding API 服务：支持 OpenAI 与 DeepSeek 提供商，自动回退默认 baseUrl
  - 混合搜索：`vec_distance_cosine` 向量搜索 Top-5 + FTS5 全文搜索 Top-5 + RRF 融合排序
  - 聊天集成：`POST /chat` 支持 `knowledgeBaseIds`，检索失败时通过 SSE `warning` 事件通知前端
  - 前端 `@提及` 交互：输入 `@` 弹出知识库下拉列表，选择后渲染 pill/tag，支持多选和删除
  - 索引进度条与文件索引状态（已索引/排队中/失败）实时显示
  - `messages` 表增加 `knowledge_base_ids` JSON 数组字段

### #04b 文件操作后索引同步

- **状态**：`closed`
- **文件**：`.scratch/knowledge-base/issues/04b-index-sync-for-file-operations.md`
- **验收标准**：全部达成（经 code review 修正知识库重命名逻辑）
- **关键交付**：
  - `indexer.ts`：`deleteFileChunks`（导出）、`updateChunkFilePaths`、`syncFtsFilePaths`
  - `knowledgeBases.ts`：`POST /move` 删除源索引+目标入队、`POST /copy` 目标入队、`PATCH /:id/files/*` 更新 file_path
  - `indexSync.test.ts`：覆盖移动/复制/文件重命名/知识库重命名四种场景
  - 修复：`indexFile` 文件不存在时静默跳过、测试环境 `db.close()` 与 Windows `EBUSY` 冲突

---

## 后续计划

### 第二波：配置与历史（可并行）

#### #05 多提供商设置

- **状态**：`closed`
- **依赖**：#02（closed）
- **优先级**：中
- **内容**：设置页 UI、多 LLM 提供商配置（OpenAI/Claude/DeepSeek/Custom/Ollama）、Embedding 配置、温度滑块、每会话模型切换
- **计划文档**：`docs/superpowers/plans/2026-05-08-settings-multi-provider.md`
- **关键交付**：
  - `config.json` 多提供商结构持久化，`GET/POST /settings` Sidecar API
  - 前端 `AppConfig` 类型与 `useSettingsStore`：API 读写、`getLLMConfig` 转换、`configuredProviders` 计算属性
  - `SettingsPage.vue`：LLM 提供商 Tab 卡片、Embedding 卡片、通用设置（温度滑块）卡片
  - `ModelSelector.vue`：对话页顶部模型下拉切换，仅影响当前会话
  - 新建会话继承全局 `defaultChatProvider`，`Tab` 增加 `provider`/`model` 快照字段
  - `sendMessage` 升格首页时记录 provider/model，无可用配置时提示用户前往设置

#### #06 对话历史

- **状态**：`closed`
- **依赖**：#02（closed）
- **优先级**：中
- **内容**：历史会话列表页、点击恢复（复用首页占位符或新建标签）、删除历史、重命名会话
- **计划文档**：`docs/superpowers/plans/2026-05-08-chat-history.md`
- **关键交付**：
  - Sidecar API 增强：`GET /sessions` 返回 summary（末消息截断 100 字）、`POST /:id/rename`、`DELETE /:id` 级联删除消息
  - `useSessionStore` 扩展：`loadHistory`、`restoreSession`（复用首页占位符/新建/激活已有）、`deleteSession`（关标签+清消息+刷新列表）、`renameSession`（同步标签标题）
  - `HistoryPage.vue`：Tabs（问答历史）、会话列表（标题/时间/摘要/消息数）、悬浮操作（重命名/删除）、空状态引导
  - `App.vue` 集成：替换 history 占位符为 `HistoryPage` 组件

### 第三波：本地化与稳定性（依赖 #05 完成后）

#### #07 Ollama 本地模型与错误处理

- **状态**：`closed`
- **依赖**：#02（closed）、#05（closed）
- **优先级**：中
- **内容**：Ollama 本地模型支持（OpenAI 兼容格式）、全局错误处理（API/网络/sidecar 不可达）、Loading 指示器、空状态引导、输入框禁用状态
- **关键交付**：
  - `streamChatCompletion` 支持 Ollama 无 API Key 调用与 SSE 流式返回
  - `POST /chat` 错误分类：api_error / network_error / sidecar_error / unknown，通过 SSE `error` 事件输出
  - `sessionStore.sendMessage`：发送前重置错误、sidecar 未就绪/LLM 未配置时阻止发送并设置 `sendErrorType`
  - `ChatErrorCard.vue`：按错误类型渲染标签（API 错误/网络错误/未知错误），支持重试
  - `ChatLoading.vue`：AI 思考时显示 "思考中..." + 闪烁光标
  - `ChatInput.vue`：LLM 未配置/发送中/空内容时禁用输入和发送按钮
  - `GlobalToast.vue`：`sendError` 变化时自动显示，5 秒后消失，支持手动关闭
  - 空状态引导：`KnowledgeBasePage`（暂无知识库）、`HistoryPage`（暂无对话历史）、`EmptySession`（快捷提问胶囊）

### 第四波：质量保障（持续进行）

#### #08 测试覆盖

- **状态**：`closed`
- **依赖**：#01 ~ #07
- **优先级**：低
- **内容**：补全所有前端组件测试、Store 测试、Sidecar API 集成测试、工具函数测试，覆盖率达标（lines >= 70%, branches >= 55%, functions >= 60%, statements >= 70%）
- **进度**：当前 **45 个测试文件，296 条用例全部通过**。已覆盖组件：FileExplorer、EditKbDialog、RecycleBinPage、ChatMessage、TabBar、SideBar、EmptySession、SplashScreen、KnowledgeBasePage、ChatInput、KbMentionDropdown、SettingsPage、ModelSelector、HistoryPage、MoveCopyDialog、KbMentionPill 等；已覆盖 Store：settings、session、useKnowledgeBaseStore；已覆盖 Server：embedding、indexer、rag、chatRag、dbSchema、settings、sessions、knowledgeBasesExtended；已覆盖 Utils：markdown、confirm。

#### #09 端到端测试

- **状态**：`closed`
- **依赖**：#01 / #03b / #04 / #04b / #05 / #06
- **优先级**：中
- **内容**：三阶端到端测试体系：阶1 Playwright 前端 E2E（mock IPC）、阶2 Vitest + 真实 Sidecar 集成、阶3 Playwright + WebView2 CDP 全链路验收
- **进度**：
  - 阶1 完成（28 条用例）：`kb-context-menu.spec.ts`（15 条）、`chat-mention.spec.ts`（3 条）、`settings.spec.ts`（4 条）、`chat-history.spec.ts`（6 条）。统一 `http-routes.ts` mock 拦截层。Page Objects 完整（ChatPage / KnowledgeBasePage / HistoryPage / SettingsPage）。
  - 阶2 完成（34 条用例）：`sidecar-lifecycle.spec.ts`（4 条）、`rag-flow.spec.ts`（5 条）、`index-sync.spec.ts`（20 条）、`sessions.spec.ts`（5 条）、`settings-api.spec.ts`（5 条）。含 mock Embedding/LLM server、sidecar 进程生命周期管理（`pool: 'forks'` 隔离）。
  - 阶3 完成（3 条用例）：`tests/e2e-full/smoke.spec.ts` 覆盖核心用户旅程（CDP 连接 Tauri WebView2）。
  - 生产 Bug 修复：Server 环境变量读取、FTS5 `chunk_id` schema、缺失 `POST /sessions`、Settings save 返回值。
  - CI：`.github/workflows/e2e.yml` 自动运行阶1+阶2。

---

## 测试用例

每个 Issue 的详细测试用例存放在 `docs/test-cases/` 目录下，按 Issue 编号独立文件：

| 文件 | 对应 Issue |
|------|-----------|
| `01-sidecar-startup-test-cases.md` | #01 |
| `02-basic-chat-test-cases.md` | #02 |
| `03-knowledge-base-management-test-cases.md` | #03 |
| `03b-kb-context-menus-and-file-operations-test-cases.md` | #03b |
| `04-rag-indexing-retrieval-test-cases.md` | #04 |
| `05-settings-multi-provider-test-cases.md` | #05 |
| `06-chat-history-test-cases.md` | #06 |

---

### #10 Shell 抽象与浏览器模式

- **状态**：`closed`
- **文件**：`.scratch/knowledge-base/issues/10-shell-abstraction-and-browser-mode.md`
- **依赖**：#09（closed）
- **优先级**：高
- **内容**：提取 Shell 模块将前端与 Tauri 解耦，使 Web 应用可在浏览器独立运行
- **计划文档**：`docs/superpowers/plans/2026-05-14-shell-abstraction.md`（待创建）
- **关键交付**：
  - `Shell` 接口 + `TauriShell` / `BrowserShell` / `MemoryShell` 适配器
  - 浏览器模式：`pnpm dev` 无需 Tauri 即可运行
  - 测试改善：单元测试注入 `MemoryShell`，E2E 移除 `tauri-ipc.ts` mock

### #11 BackendTransport 统一

- **状态**：`closed`
- **文件**：`.scratch/knowledge-base/issues/11-backend-transport-unification.md`
- **依赖**：#10（closed）
- **优先级**：高
- **内容**：统一 HTTP 通信模块，将 `sidecarClient.ts` 浅模块深化为高 leverage 的 `BackendTransport` 接口
- **计划文档**：待创建
- **关键交付**：
  - `BackendTransport` 接口 + `HttpBackendTransport` / `FakeBackendTransport` 实现
  - 所有 `sidecarFetch` 调用替换为 `backendTransport.request`
  - SSE 聊天流统一为 `backendTransport.subscribe`
  - Store 测试注入 `FakeBackendTransport`，完全脱离网络

---

*最后更新：2026-05-14（#10 Shell 抽象、#11 BackendTransport 统一已完成）*
