# 项目进度追踪（Progress）

本文档记录 Knowledge Base 应用所有 Issue 的执行进度与后续开发计划。

> **更新日期**：2026-05-09  
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
| 本地模型 | #07 Ollama 与错误处理 | ready-for-agent | Ollama 本地模型、全局错误处理、Loading/空状态 |
| 质量保障 | #08 测试覆盖 | in-progress | 38 个测试文件、254 条用例全部通过，持续补充中 |
| 质量保障 | #09 端到端测试 | in-progress | 阶1 前端 E2E 已搭建（6 条 Playwright 用例通过），阶2/阶3 待搭建 |

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

- **状态**：`ready-for-agent`
- **依赖**：#02（closed）、#05
- **优先级**：中
- **内容**：Ollama 本地模型支持（OpenAI 兼容格式）、全局错误处理（API/网络/sidecar 不可达）、Loading 指示器、空状态引导、输入框禁用状态

### 第四波：质量保障（持续进行）

#### #08 测试覆盖

- **状态**：`in-progress`
- **依赖**：#01 ~ #07
- **优先级**：低
- **内容**：补全所有前端组件测试、Store 测试、Sidecar API 集成测试、工具函数测试，覆盖率达标（lines >= 10%, branches >= 10%）
- **进度**：当前 **41 个测试文件，271 条用例全部通过**。已覆盖组件：FileExplorer、EditKbDialog、RecycleBinPage、ChatMessage、TabBar、SideBar、EmptySession、SplashScreen、KnowledgeBasePage、ChatInput、KbMentionDropdown、SettingsPage、ModelSelector、HistoryPage 等；已覆盖 Store：settings、session、useKnowledgeBaseStore；已覆盖 Server：embedding、indexer、rag、chatRag、dbSchema、settings、sessions。

#### #09 端到端测试

- **状态**：`in-progress`
- **依赖**：#01 / #03b / #04 / #04b / #05 / #06
- **优先级**：中
- **内容**：三阶端到端测试体系：阶1 Playwright 前端 E2E（mock IPC）、阶2 Vitest + 真实 Sidecar 集成、阶3 Playwright + WebView2 CDP 全链路验收
- **进度**：
  - 阶1 已搭建：Playwright 配置、`tauri-ipc.ts` mock、`fixtures/knowledge-bases.ts`、Page Objects（ChatPage / KnowledgeBasePage）、`kb-context-menu.spec.ts`（3 条通过）、`chat-mention.spec.ts`（3 条通过）。`pnpm test:e2e` 稳定通过 6 条用例。
  - 待补充阶1：settings.spec.ts（#05）、chat-history.spec.ts（#06）、kb-context-menu 剩余 9 个场景、http-routes.ts 统一拦截层、HistoryPage / SettingsPage Page Objects。
  - 阶2 未开始：需创建 `tests/integration/`、`vitest.integration.config.ts`、mock Embedding/LLM server、sidecar 生命周期管理。
  - 阶3 未开始：需创建 `tests/e2e-full/`、CDP 配置、Tauri 调试端口暴露。

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

*最后更新：2026-05-11（#06 对话历史完成）*
