# 知识库应用（Knowledge Base）

基于 Tauri v2 + Vue 3 + Node.js Hono Sidecar 的本地知识库桌面应用。用户导入文档进行管理，通过 LLM 进行问答，支持 RAG 检索增强。

---

## 术语表

### 知识库（Knowledge Base）

物理上对应 `knowledge-base/docs/` 下的一个子目录。用户可新建、删除（移入回收站）、置顶、修改资料（名称/图标）、管理其中的文件和子文件夹。每个知识库独立进行 RAG 索引。

### 回收站（Trash）

删除的知识库被物理移动到 `knowledge-base/.trash/<知识库名>-<timestamp>/`。恢复时移回原位；若同名冲突则重命名为 `<原名>-副本`。第一版不实现 30 天自动清理。

### 首页（Home Tab）

顶部标签栏中始终保留的特殊占位符标签，**不是一个持久化会话**。用户在首页输入第一条消息后，首页自动升格为一个有 ID 的真实会话（存入 SQLite），同时系统创建一个新的首页占位符。

### 会话（Session）

问答对话的持久化单元，存储在 SQLite `sessions` 表中。一个会话同一时间只能在一个标签页中打开（1:1 关系）。会话级别保存当前使用的 LLM provider 和 model。

### 消息（Message）

会话中的一轮对话，存储在 SQLite `messages` 表中。每条消息可独立关联一组知识库（`knowledge_base_ids`），通过 `@知识库名称` 提及触发 RAG 检索。

### 置顶（Pin）

知识库列表的排序优先级标记。置顶的知识库显示在列表顶部，按 `sort_order` 排序。状态持久化在 SQLite `knowledge_bases.is_pinned` 字段。

### 回收站入口（Trash Entry）

左侧知识库列表底部的固定入口项，点击后打开回收站页面，展示已删除的知识库列表并支持恢复。

### Sidecar

Node.js 运行的 Hono HTTP 服务，承载全部业务逻辑（LLM 问答、RAG、LangChain、SQLite、Embedding API 调用）。由 Tauri Rust 进程启动、监控和自动重启。

### RAG 检索

对用户消息中 `@提及` 的知识库进行向量检索。流程：消息 → sidecar 提取 `knowledgeBaseIds` → 对各知识库的文档块做 Embedding query → SQLite BLOB 向量应用层余弦相似度计算 → Top-K 文档块拼入 system prompt → 调用 LLM。

---

## 架构分层

| 层 | 职责 | 技术 |
|---|---|---|
| Tauri Rust | 桌面壳：窗口管理、启动/监控 sidecar、文件 I/O 中转、提供 appData 路径 | Rust |
| Hono Sidecar | 全部业务逻辑：LLM 问答、RAG、LangChain、SQLite、Embedding API、向量计算 | TS + Hono |
| 前端 Vue | UI 渲染、状态管理、HTTP 调用 sidecar | Vue 3 + Pinia |

---

## 数据持久化

- **结构化数据**（会话、消息、知识库、文档块、向量）统一使用 **SQLite**，由 sidecar 管理
- **用户配置**（LLM provider、API Key、温度等）使用 **JSON** (`config.json`)，由 sidecar 读写
- 应用运行时数据目录：`app.getPath('userData')/knowledge-base/`

---

## 关键设计决策

### 1. 引入 Node.js Hono Sidecar

**Why:** 业务核心依赖 LangChain/Node 生态，团队主技术栈为 Node.js，减少 Rust 开发负担。Tauri Rust 层保持轻量，专注窗口管理和高性能文件 I/O。

### 2. 知识库 = 物理子目录

**Why:** 物理映射最直观，用户可直接在文件系统查看和管理。RAG 索引按知识库粒度进行。

### 3. RAG 向量存储：SQLite + sqlite-vec + 混合搜索

**Why:** `sqlite-vec` 提供 HNSW 向量索引（O(log N)），解决纯 BLOB 全表扫描的性能问题。同时引入 FTS5 全文搜索，通过 RRF 融合向量相似度和关键词匹配结果，提升检索召回率。

### 4. 知识库检索：@提及 而非全局开关

**Why:** 比全局/会话级开关更灵活。用户按需引入知识库，每条消息独立决定检索范围。后续知识库页面将支持"在此知识库上直接对话"的快捷入口。

### 5. 首页占位符语义

**Why:** 始终保留一个空入口，降低用户新建会话的认知成本。首次提问后自动升格为真实会话，避免空标签与有内容标签的语义混乱。

### 6. 文件导入：Rust 中转

**Why:** Tauri 前端获得的是临时文件访问权限，sidecar 作为独立进程无法直接访问。Rust 读取文件内容后 HTTP POST 到 sidecar，符合分层且能利用 Rust 的高性能 I/O。

### 7. Session 与标签页 1:1

**Why:** 避免跨标签状态同步的复杂性。对话历史恢复时优先复用当前空首页占位符，否则新建标签。关闭标签仅关闭 UI 视图，不删除会话数据。

### 8. 索引触发：队列后台处理

**Why:** 批量导入文件时避免频繁调用 Embedding API。sidecar 维护索引队列，逐个处理，前端显示索引进度。

### 9. LLM 配置：多提供商 + 每会话模型

**Why:** 用户可能持有多个 API Key。设置页保存所有提供商配置，对话页顶部提供模型快速切换，切换仅影响当前会话。会话表记录使用的 provider + model 快照。
