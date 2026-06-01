# 完成日志

格式：`[状态] 轨道 issue-id 摘要 — 关键变更点（测试数），[issue链接]`

---

## [2026-06-01]

### infra

- [closed] i-02 pgvector 基础设施迁移 — Docker Compose 移除 milvus，postgres 改用 pgvector:pg16，Prisma Schema 添加 embedding 列，生成迁移文件 [issue](docs/issues/i-02-pgvector-infra-migration/)

### backend

- [closed] b-12 PgVectorStore + VectorService 切换 — 新建 PgVectorStore（SDK IVectorStore 实现），VectorService 切换，移除 deleteByFileId/deleteByKbId（ON DELETE CASCADE 处理） [issue](docs/issues/b-12-pgvector-store-service/)
- [closed] b-13 PrismaVectorIndexer 重写 — 单事务写入 chunks + embedding，computeTokenCounts 三级策略，ON CONFLICT 支持重试，IndexingWorker/QueueModule 适配 [issue](docs/issues/b-13-prisma-vector-indexer/)

### quality

- [closed] q-23 集成测试层修复 — infra.spec.ts Playwright→vitest 转换，新建 setup.ts/teardown.ts，rag-real.spec.ts 适配 pgvector，清理 sidecar/ 遗留目录 [issue](docs/issues/q-23-integration-test-fix/)

### docs

- [docs] 重建计划制定 — 创建 6 个 issue 实施 ADR 0005（pgvector 替代 Milvus）
- [docs] BACKLOG.md & CHANGELOG.md 同步

---

## [2026-05-30]

### quality

- [closed] q-22 RAG 真实集成测试 — rag-real.spec.ts 验证索引链路（AC-03）和检索链路（AC-04），含失败降级（AC-05），基础设施不可用时优雅跳过 [issue](docs/issues/q-22-rag-real-integration-tests/)
- [closed] q-21 RAG Server E2E — 测试骨架（setup/teardown/mock servers/4 AC），infraAvailable 环境检测自动跳过 [issue](docs/issues/q-21-rag-server-integration-e2e/)
- [closed] q-19 E2E 设置持久化与跨模块用户旅程 — settings-persist.spec.ts（9 AC）+ onboarding-journey.spec.ts（6 AC） [issue](docs/issues/q-19-e2e-settings-journey/)
- [closed] q-18 E2E 聊天 SSE 流式响应与会话管理 — chat-with-rag.spec.ts（9 AC）+ session-management.spec.ts（11 AC） [issue](docs/issues/q-18-e2e-chat-session-specs/)
- [closed] q-16 E2E 基础设施重构 — 删除 Tauri E2E，建立真实 API Web E2E（globalSetup/globalTeardown/fixtures/.env.e2e） [issue](docs/issues/q-16-e2e-infra-migration/)

### docs

- [docs] BACKLOG.md & CHANGELOG.md 同步

---

## [2026-05-29]

### backend

- [closed] b-10 Server 向量与关键词适配 — VectorService 适配 IVectorStore，KeywordService 实现 IKeywordStore（PostgreSQL FTS + zhparser），9 个测试通过 [issue](docs/issues/b-10-server-vector-keyword-adapters/)
- [closed] b-11 文档解析与索引写入 — DocumentParser（MIME 解析，PDF 预留），PrismaMilvusIndexer（chunk.id 共享主键，消除 milvusId 回写），11 个测试通过 [issue](docs/issues/b-11-document-parser-indexer/)
- [closed] b-08 索引 Worker 集成 — IndexingWorker（BullMQ + runIndexing + failed 状态更新），QueueModule 注册 DOCUMENT_JOB_HANDLER，8 个测试通过 [issue](docs/issues/b-08-indexing-worker-integration/)
- [closed] b-09 Chat RAG 检索 — ChatService.streamChat 注入 HybridRetriever + DefaultRetrievalPostprocessor，检索失败降级，8 个测试通过 [issue](docs/issues/b-09-chat-rag-retrieval/)

### frontend

- [closed] f-16 前端 Chat KB 选择器 — KbSelector 扩展 error 状态，ChatInput 常驻 KB 按钮，ChatView :key 自动重置，12 个测试通过 [issue](docs/issues/f-16-chat-kb-selector/)

### docs

- [closed] RAG Server 集成 PRD — server 端 RAG 集成需求全部实现，55 个测试通过 [PRD](docs/prd/rag-server-integration.md)
- [docs] BACKLOG.md & CHANGELOG.md 同步

---

## [2026-05-28]

### docs

- [open] RAG Server 集成 PRD — 定义 server 端 RAG 集成需求 [PRD](docs/prd/rag-server-integration.md)
- [open] d-20 ~ q-21 — 7 个 RAG server 集成 issue 的 spec 和 plan 创建

---

## [2026-05-27]

### design

- [closed] d-15 RAG SDK 集成验证 — 5 AC（最小闭环 demo / server 集成点文档 / 覆盖率 97.44%），修复 RecursiveCharacterChunker 无限循环 [issue](docs/issues/d-15-rag-sdk-integration/)
- [closed] d-11 RAG SDK Core 契约层 — 9 AC（types/schema/interfaces/errors/pipeline/vector-store/index），Zod v4 类型推导，12 个测试通过 [issue](docs/issues/d-11-rag-sdk-core-contracts/)
- [closed] d-12 RAG SDK 索引构建模块 — 7 AC（RecursiveCharacterChunker / OpenAIEmbedder / MilvusIndexer / runIndexing），15 个测试通过 [issue](docs/issues/d-12-rag-sdk-indexing-module/)
- [closed] d-13 RAG SDK 在线检索模块 — 9 AC（HybridRetriever / RRF / DefaultRetrievalPostprocessor / SelectionTrace / runRetrievalPipeline），20 个测试通过 [issue](docs/issues/d-13-rag-sdk-runtime-module/)
- [closed] d-14 RAG SDK 可观测性模块 — 6 AC（RAGTracer / consoleObserver / 类型定义），7 个测试通过 [issue](docs/issues/d-14-rag-sdk-observability/)

---

## [2026-05-23]

### backend

- [closed] b-05 ChatController 测试 — 17 AC（SSE 流式响应/abort/持久化/DTO 校验/LLM 异常/E2E 链路），修复 controller 错误提取 [issue](docs/issues/b-05-chat-api-testing/)
- [closed] b-04 KnowledgeBaseController 测试 — 15 AC（list/create/update/delete + DTO 校验 + 多用户隔离） [issue](docs/issues/b-04-knowledge-base-api-testing/)
- [closed] b-03 DocumentController 测试 — 21 AC（upload/create/update/delete/list + DTO 校验 + 文件上传边界 + 权限控制） [issue](docs/issues/b-03-document-api-testing/)
- [closed] b-02 AuthController 测试 — AC-01~AC-15 + E2E 链路 AC-16（public-key/register/login/refresh/logout/me） [issue](docs/issues/b-02-auth-api-testing/)

### frontend

- [closed] f-10 ContextMenu 迁移 — FileManager/FileExplorer/KnowledgeBasePage 内联 ContextMenu 迁移至 overlays/，建立前端 overlay 规范 [issue](docs/issues/f-10-context-menu-and-conventions/)
- [closed] f-09 Dialog 迁移 — FileManager 内联 Dialog + 独立组件迁移至 overlays/ [issue](docs/issues/f-09-dialog-migration/)

---

## [2026-05-22]

### infra

- [closed] i-01 API 测试共享基础设施 — 5 个 helper + vitest 配置 + .env.test [issue](docs/issues/i-01-testing-infra-setup/)

### frontend

- [closed] f-08 Overlay 核心机制 — Dialog/ContextMenu 函数式调用基础设施 [issue](docs/issues/f-08-overlay-core/)

---

## [2026-05-20]

### frontend（已归档）

- [closed] f-19 设置页账户 Tab [归档](docs/99-archived/issues/f-19-settings-account-tabs/)
- [closed] f-15 TabBar 全局化重构 [归档](docs/99-archived/issues/f-15-global-tab-bar/)
- [closed] f-16 统一 Tab 类型定义 [归档](docs/99-archived/issues/f-16-unified-tab-types/)
- [closed] f-17 路由单例标签 [归档](docs/99-archived/issues/f-17-route-singleton-tabs/)
- [closed] f-18 清理 ChatPage 遗留组件 [归档](docs/99-archived/issues/f-18-cleanup-chatpage/)

---

## [2026-05-19]

### quality（已归档）

- [closed] q-04 密码传输加密 [归档](docs/99-archived/issues/q-04-password-transport-encryption/)
- [closed] q-01 安全基线 [归档](docs/99-archived/issues/q-01-security-baseline/)

---

## [2026-05-18]

### quality/infra（已归档）

- [closed] q-03 V1 清理 [归档](docs/99-archived/issues/q-03-v1-cleanup/)
- [closed] i-06 数据迁移工具 [归档](docs/99-archived/issues/i-06-data-migration/)

---

## [2026-05-17]

### backend/infra（已归档）

- [closed] i-07 API 客户端升级 [归档](docs/99-archived/issues/i-07-api-client/)
- [closed] b-05 设置 API [归档](docs/99-archived/issues/b-05-settings-api/)
- [closed] b-03 会话 API [归档](docs/99-archived/issues/b-03-session-api/)
- [closed] b-04 SSE 流式对话 API [归档](docs/99-archived/issues/b-04-chat-sse-api/)

---

## [2026-05-16]

### infra/design（已归档）

- [closed] i-00 核心接口定义 [归档](docs/99-archived/issues/i-00-core-interfaces/)
- [closed] i-01 Docker Compose 基础设施 [归档](docs/99-archived/issues/i-01-docker-compose-infra/)
- [closed] i-02 Prisma 数据模型 [归档](docs/99-archived/issues/i-02-prisma-setup/)
- [closed] i-08 NestJS 服务器 [归档](docs/99-archived/issues/i-08-nestjs-server-setup/)
- [closed] i-09 NestJS 认证系统 [归档](docs/99-archived/issues/i-09-nestjs-auth-system/)
- [closed] i-10 NestJS 安全基线 [归档](docs/99-archived/issues/i-10-nestjs-security/)
- [closed] i-11 MinIO 服务 [归档](docs/99-archived/issues/i-11-minio-service/)
- [closed] i-12 Milvus 服务 [归档](docs/99-archived/issues/i-12-milvus-service/)
- [closed] i-13 BullMQ 服务 [归档](docs/99-archived/issues/i-13-bullmq-service/)
- [closed] i-14 JWT API 客户端 [归档](docs/99-archived/issues/i-14-jwt-api-client/)
- [closed] d-01 RAG SDK 合约 [归档](docs/99-archived/issues/d-01-rag-sdk-contracts/)

---

## [2026-05-15]

### frontend/backend（已归档）

- [closed] f-01 登录/注册页 [归档](docs/99-archived/issues/f-01-auth-pages/)
- [closed] f-02 路由守卫 [归档](docs/99-archived/issues/f-02-route-guard/)
- [closed] f-03 侧边栏导航 [归档](docs/99-archived/issues/f-03-sidebar-navigation/)
- [closed] f-04 聊天页标签栏 [归档](docs/99-archived/issues/f-04-tab-bar/)
- [closed] f-05 知识库列表 [归档](docs/99-archived/issues/f-05-knowledge-base-list/)
- [closed] f-06 文件管理器 [归档](docs/99-archived/issues/f-06-knowledge-base-file-manager/)
- [closed] f-07 文件上传组件 [归档](docs/99-archived/issues/f-07-file-upload-component/)
- [closed] f-08 文件夹管理 [归档](docs/99-archived/issues/f-08-folder-management/)
- [closed] f-09 问答对话页 [归档](docs/99-archived/issues/f-09-chat-page/)
- [closed] f-10 消息渲染器 [归档](docs/99-archived/issues/f-10-message-renderer/)
- [closed] f-11 知识库选择器 [归档](docs/99-archived/issues/f-11-kb-selector/)
- [closed] f-12 对话历史 [归档](docs/99-archived/issues/f-12-chat-history/)
- [closed] f-13 设置页 [归档](docs/99-archived/issues/f-13-settings-page/)
- [closed] f-14 适配器移除 [归档](docs/99-archived/issues/f-14-adapter-removal/)
- [closed] b-02 知识库 CRUD API [归档](docs/99-archived/issues/b-02-knowledge-base-crud-api/)
