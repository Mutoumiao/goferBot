# 项目进度追踪（Progress）

本文档记录 Knowledge Base 应用所有 Issue 的执行进度与后续开发计划。

> **更新日期**：2026-05-08  
> **对应 Issue 目录**：`.scratch/knowledge-base/issues/`

---

## 进度概览

| 阶段 | Issue | 状态 | 说明 |
|------|-------|------|------|
| 基础设施 | #01 Sidecar 启动 | closed | Tauri ↔ Node.js Sidecar 启动、发现、生命周期管理 |
| 核心功能 | #02 基础对话 | closed | SSE 流式问答、会话标签管理、消息存储 |
| 核心功能 | #03 知识库管理 | closed | CRUD、文件导入、资源管理器、回收站 |
| 增强功能 | #03b 右键菜单与文件操作 | closed | 置顶、修改资料、新建文件夹、重命名、移动/复制、回收站页面 |
| 核心功能 | #04 RAG 索引检索 | ready-for-agent | sqlite-vec + FTS5 混合搜索、索引队列、`@提及` 交互 |
| 索引同步 | #04b 文件操作后索引同步 | ready-for-agent | 跨库移动/复制/重命名后的 document_chunks 同步 |
| 配置系统 | #05 多提供商设置 | ready-for-agent | 设置页、多 LLM 配置、Embedding 配置、温度参数 |
| 历史管理 | #06 对话历史 | ready-for-agent | 历史列表、恢复会话、删除、重命名 |
| 本地模型 | #07 Ollama 与错误处理 | ready-for-agent | Ollama 本地模型、全局错误处理、Loading/空状态 |
| 质量保障 | #08 测试覆盖 | ready-for-agent | 完整测试覆盖、组件测试、Store 测试、API 测试 |

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

---

## 后续计划

### 第一波：知识库增强（可并行）

#### #03b 知识库右键菜单与文件操作

- **状态**：`closed`
- **依赖**：#03
- **优先级**：高
- **内容**：补齐 #03 遗漏的前端交互——知识库列表右键菜单（置顶/修改资料/删除）、文件区域右键菜单（新建文件夹/重命名/移动/复制/删除）、回收站页面入口、行内重命名编辑、移动/复制弹窗、命名冲突处理

#### #04 RAG 索引检索

- **状态**：`ready-for-agent`
- **依赖**：#02、#03
- **优先级**：高
- **内容**：文件导入后自动索引队列、LangChain 分块、Embedding API、sqlite-vec HNSW 向量索引、FTS5 全文索引、混合搜索（RRF 融合）、前端 `@提及` 知识库交互

### 第二波：配置与历史（依赖 #04 完成后）

#### #05 多提供商设置

- **状态**：`ready-for-agent`
- **依赖**：#02
- **优先级**：中
- **内容**：设置页 UI、多 LLM 提供商配置（OpenAI/Claude/DeepSeek/Custom/Ollama）、Embedding 配置、温度滑块、每会话模型切换

#### #06 对话历史

- **状态**：`ready-for-agent`
- **依赖**：#02
- **优先级**：中
- **内容**：历史会话列表页、点击恢复（复用首页占位符或新建标签）、删除历史、重命名会话

### 第三波：本地化与稳定性（依赖 #05 完成后）

#### #07 Ollama 本地模型与错误处理

- **状态**：`ready-for-agent`
- **依赖**：#02、#05
- **优先级**：中
- **内容**：Ollama 本地模型支持（OpenAI 兼容格式）、全局错误处理（API/网络/sidecar 不可达）、Loading 指示器、空状态引导、输入框禁用状态

#### #04b 文件操作后索引同步

- **状态**：`ready-for-agent`
- **依赖**：#03、#03b、#04
- **优先级**：中
- **内容**：跨库移动/复制/重命名后，同步更新 `document_chunks` / `vec_document_chunks` / `fts_document_chunks`，复用 #04 的索引队列做增量更新

### 第四波：质量保障（全部功能完成后）

#### #08 测试覆盖

- **状态**：`ready-for-agent`
- **依赖**：#01 ~ #07
- **优先级**：低（最后执行）
- **内容**：补全所有前端组件测试、Store 测试、Sidecar API 集成测试、工具函数测试，覆盖率达标（lines >= 10%, branches >= 10%）

---

## 测试用例

每个 Issue 的详细测试用例存放在 `docs/test-cases/` 目录下，按 Issue 编号独立文件：

| 文件 | 对应 Issue |
|------|-----------|
| `01-sidecar-startup-test-cases.md` | #01 |
| `02-basic-chat-test-cases.md` | #02 |
| `03-knowledge-base-management-test-cases.md` | #03 |

---

*最后更新：2026-05-08*
