# 项目进度追踪（Progress）

> **更新日期**：2026-05-14  
> **Issue 目录**：[`.scratch/knowledge-base/issues/`](.scratch/knowledge-base/issues/)

---

## 进度概览

| 阶段 | Issue | 状态 | 说明 |
|------|-------|------|------|
| 基础设施 | [#01 Sidecar 启动](.scratch/knowledge-base/issues/01-sidecar-startup.md) | closed | Tauri ↔ Node.js Sidecar 启动、发现、生命周期管理 |
| 核心功能 | [#02 基础对话](.scratch/knowledge-base/issues/02-basic-chat.md) | closed | SSE 流式问答、会话标签管理、消息存储 |
| 核心功能 | [#03 知识库管理](.scratch/knowledge-base/issues/03-knowledge-base-management.md) | closed | CRUD、文件导入、资源管理器、回收站 |
| 增强功能 | [#03b 右键菜单与文件操作](.scratch/knowledge-base/issues/03b-kb-context-menus-and-file-operations.md) | closed | 置顶、修改资料、新建文件夹、重命名、移动/复制 |
| 核心功能 | [#04 RAG 索引检索](.scratch/knowledge-base/issues/04-rag-indexing-retrieval.md) | closed | sqlite-vec + FTS5 混合搜索、索引队列、`@提及` 交互 |
| 索引同步 | [#04b 文件操作后索引同步](.scratch/knowledge-base/issues/04b-index-sync-for-file-operations.md) | closed | 跨库移动/复制/重命名后的 document_chunks 同步 |
| 配置系统 | [#05 多提供商设置](.scratch/knowledge-base/issues/05-settings-multi-provider.md) | closed | 设置页、多 LLM 配置、Embedding 配置、温度参数 |
| 历史管理 | [#06 对话历史](.scratch/knowledge-base/issues/06-chat-history.md) | closed | 历史列表、恢复会话、删除、重命名 |
| 本地模型 | [#07 Ollama 与错误处理](.scratch/knowledge-base/issues/07-ollama-error-handling.md) | closed | Ollama 本地模型、全局错误处理、Loading/空状态 |
| 质量保障 | [#08 测试覆盖](.scratch/knowledge-base/issues/08-test-coverage.md) | closed | 46 个测试文件、301 条用例全部通过 |
| 质量保障 | [#09 端到端测试](.scratch/knowledge-base/issues/09-end-to-end-testing.md) | closed | 阶1 E2E 28 条、阶2 集成 34 条、阶3 验收 3 条 |
| 架构重构 | [#10 Shell 抽象与浏览器模式](.scratch/knowledge-base/issues/10-shell-abstraction-and-browser-mode.md) | closed | 提取 Shell 模块解耦前端与 Tauri，Web 可独立运行 |
| 架构重构 | [#11 BackendTransport 统一](.scratch/knowledge-base/issues/11-backend-transport-unification.md) | closed | 统一 HTTP 通信模块，sidecarClient 浅模块深化 |
| 架构重构 | [#12 Monorepo 结构迁移](.scratch/knowledge-base/issues/12-monorepo-migration.md) | closed | pnpm workspace 五包拆分，构建测试全通过 |

---

## 测试用例

详细测试用例见 [`docs/test-cases/`](docs/test-cases/)。

---

*最后更新：2026-05-14（#12 Monorepo 迁移完成）*
