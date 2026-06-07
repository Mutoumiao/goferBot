# 完成日志

格式：`[状态] 轨道 issue-id 摘要 — 关键变更点（测试数），[issue链接]`

---

## [2026-06-07]

### frontend

- [closed] i-32 packages/web 基建搭建 — TanStack Start + Vite 8 + SPA + Tailwind v4 + Pencil tokens（13 色板）+ cn()，构建✅ 类型检查✅ [issue](docs/issues/i-32-web-infra-setup/)
- [closed] f-33 鉴权系统 — alova Token 刷新队列（isRefreshing + refreshSubscribers）+ packages/data/ 共享 Zod schemas（3 域）+ Zustand auth store（persist）+ login/register + beforeLoad 路由守卫 [issue](docs/issues/f-33-auth-flow-migration/)
- [closed] f-34 Overlay + App Shell — React Portal 命令式 API（openDialog/openContextMenu 返回 Promise）+ Zustand OverlayStore + Sidebar（Link 导航）+ AuthenticatedLayout [issue](docs/issues/f-34-app-shell-overlay/)
- [open] f-35 ChatView 骨架 — MessageBubble（react-markdown）+ ChatInput + chat store（消息/流式）+ SSE 占位 [issue](docs/issues/f-35-chatview-migration/)
- [open] f-36 KB 页面骨架 — KbListPage（loading/empty/data 三态）+ kb store + api/kb.ts（5 方法） [issue](docs/issues/f-36-kb-page-migration/)
- [open] f-37 辅页面骨架 — History（会话列表+删除）+ Settings（用户信息+登出）+ RecycleBin（软删除+永久删除），api/chat.ts + api/kb.ts 方法扩展 [issue](docs/issues/f-37-aux-pages-migration/)
- [open] f-39 测试 — 13 单元测试（auth-store + cn-utility + overlay-store），tsc✅ build✅ [issue](docs/issues/f-39-test-cleanup/)

### docs

- [open] f-40~f-43 Store 补全 issue — 4 个 Pinia→Zustand 迁移（session/settings/file/tabs），含 issue.md + checklist.json [issue](docs/issues/f-40-session-store/)
- [open] f-44~f-49 功能深化 issue — 6 个阶段三深化（SSE/会话管理/文件上传/KB CRUD/Settings 表单/BlockNote），含 issue.md + checklist.json [issue](docs/issues/f-44-chat-sse-flow/)
- [docs] PRD §5.0 进度总览 — 5 阶段完成度表 + 代码量对比 + 依赖图，i-32/f-33/f-34 → closed [PRD](docs/prd/v3-frontend-migration.md)
- [docs] alova v3 参考手册 + frontend-rules.md 索引更新 [ref](docs/reference/alova-react-guide.md)

### quality

- [closed] q-31 HTTP API E2E 测试 — 15/15 通过，覆盖 Auth/KB/File+Chat 四条链路 [issue](docs/issues/q-31-http-e2e-api-tests/)
- [closed] q-30 全局中间件集成测试 — 187/187 通过，覆盖 health/response-interceptor/exceptions-filter/zod-validation-pipe/throttler-guard [issue](docs/issues/q-30-middleware-integration-tests/)
- [closed] q-29 Controller 集成测试补齐 — 187/187 通过，覆盖 session/settings/folder CRUD + error cases + 边界条件 [issue](docs/issues/q-29-controller-integration-tests-batch2/)

## [2026-06-06]

### quality

- [closed] q-28 PRD 第一批 Controller 模块级集成测试补齐 — 新建 auth.controller.spec.ts（25 测试）、document.controller.spec.ts（31 测试）、chat.controller.spec.ts（7 测试）、knowledge-base.controller.spec.ts（19 测试），覆盖 4 个 Controller 所有端点的 happy path + error cases + 边界条件，提取 createIpGenerator 共享工具消除 remoteAddress 重复代码，修复 TestAppFactory 中未生效的 ThrottlerModule 覆盖并添加注释 — 集成测试 121/121 通过，单元测试 164/164 通过 [issue](docs/issues/q-28-controller-integration-tests/)
- [closed] q-27 后端测试覆盖率门槛定义与核心模块测试补齐 — vitest.config.ts 纳入 packages/server/src/**/*.ts，定义后端门槛（行 60%/函数 50%/分支 40%）渐进式实施，新增 auth.service.spec.ts（11 测试）、knowledge-base.service.spec.ts（9 测试）、document.service.spec.ts（8 测试）— 单元测试 164/164 通过 [issue](docs/issues/q-27-backend-coverage-threshold/)
- [closed] q-26 E2E 测试数据库清理机制 — globalTeardown 调用 cleanupDatabase() 清理所有业务表，fixtures/auth.ts 新增 deleteTestUser() 支持按 email/id 删除，新增 autoCleanup fixture 自动清理，更新 e2e-testing-guide.md 文档 — 新增 5 个 E2E 测试全部通过，users 表 count = 0 验证无累积 [issue](docs/issues/q-26-e2e-db-cleanup/)
- [closed] q-25 集成测试数据库隔离统一化 — 4 个违规测试文件改造为 TestDatabaseManager 独立数据库（prisma-vector-indexer/vector-service/pgvector-store 模式 A，infra 模式 B），修复 PrismaService 构造函数忽略 options 导致 TestAppFactory 隔离失效的隐藏 bug — 集成测试 39/39 通过，单元测试 138/138 通过 [issue](docs/issues/q-25-integration-test-db-unify/)

## [2026-06-05]

### quality

- [closed] q-24 单元测试数据库隔离治理 — testglobals.ts 增加 vitest 环境双重校验数据库连接保护，prisma-pagination.spec.ts 和 session.service.spec.ts 改造为纯 Mock 模式（vi.fn()），清理开发数据库残留测试数据 — 单元测试 138/138 通过 [issue](docs/issues/q-24-unit-test-db-isolation/)

### docs

- [docs] 开发流程精简与 CHECKPOINT 协议引入 — 解决 TDD 执行不到位、流程-执行鸿沟两大根本性问题。workflow.md 6 阶段精简为 3 阶段（定义/实现/验收）；引入 Agent CHECKPOINT 协议，要求每个编码任务提供 RED + GREEN 可验证证据；同步更新 4 个 skill（project-workflow / dev-orchestrator / plan-generator / spec-validator）确保阶段归属和调用链一致
- [docs] 流程优化遗留修复 — workflow.md 删除旧版 CHECKPOINT 删除线段落；project-workflow skill 汇总表补充 `/test-scaffold` 和 `/architecture-guard`；dev-orchestrator 步骤编号统一为 5a/5b/5c；边界情况"Spec 不存在"改为回退到步骤 1 重新检查阶段 1 完成度

---

## [2026-06-04]

### backend

- [closed] b-14 Admin 用户管理与基础设施规范化 — Prisma 分页封装（paginate + exists），Session 列表修复为 { items, pagination }，RBAC 权限（@Roles + RolesGuard），Admin API（GET /admin/users + PATCH /admin/users/:id/status），登录/refresh 校验 isActive — 单元测试 55/55 通过，集成测试 39/39 通过 [issue](docs/issues/b-14-admin-user-management/)

---

## [2026-06-02]

### quality

- [closed] 测试架构清理 — 删除 16 个 V1 遗留测试文件（引用不存在模块），删除 3 个临时 vitest 配置，修复 pgvector/IndexingWorker/DocumentService 测试，3 个需真实 DB 的测试移至集成层，集成测试添加 infra-check 优雅跳过机制 — 单元测试 125/125 通过，集成测试 16/16 通过 [handoff](docs/handoff/handoff-2026-06-02-test-cleanup.md)

### docs

- [docs] 测试架构诊断 handoff — 创建 `docs/handoff/handoff-2026-06-02-test-cleanup.md`，记录问题发现、修复方案和执行记录

---

## [2026-06-01]

### infra

- [closed] i-02 pgvector 基础设施迁移 — Docker Compose 移除 milvus，postgres 改用 pgvector:pg16，Prisma Schema 添加 embedding 列，生成迁移文件 [issue](docs/issues/i-02-pgvector-infra-migration/)
- [closed] i-03 Milvus 代码清理 — 删除 MilvusVectorStore/PrismaMilvusIndexer，移除 @zilliz/milvus2-sdk-node 依赖，清理 MILVUS_ 环境变量 [issue](docs/issues/i-03-cleanup-milvus-code/)

### backend

- [closed] b-12 PgVectorStore + VectorService 切换 — 新建 PgVectorStore（SDK IVectorStore 实现），VectorService 切换，移除 deleteByFileId/deleteByKbId（ON DELETE CASCADE 处理） [issue](docs/issues/b-12-pgvector-store-service/)
- [closed] b-13 PrismaVectorIndexer 重写 — 单事务写入 chunks + embedding，computeTokenCounts 三级策略，ON CONFLICT 支持重试，IndexingWorker/QueueModule 适配 [issue](docs/issues/b-13-prisma-vector-indexer/)

### quality

- [closed] q-17 E2E 认证与知识库生命周期 — 16/16 AC 全部通过，q-17-rev 使用真实后端 API 完成 5 个 pending AC（AC-06/08/12/15/16） [issue](docs/issues/q-17-e2e-auth-kb-specs/)
- [closed] q-23 集成测试层修复 — infra.spec.ts Playwright→vitest 转换，新建 setup.ts/teardown.ts，rag-real.spec.ts 适配 pgvector，清理 sidecar/ 遗留目录 [issue](docs/issues/q-23-integration-test-fix/)

### docs

- [docs] 重建计划制定 — 创建 6 个 issue 实施 ADR 0001 向量存储决策（pgvector 替代 Milvus）
- [docs] BACKLOG.md & CHANGELOG.md 同步

---

## [2026-05-30]

### quality

- [closed] q-22 RAG 真实集成测试 — rag-real.spec.ts 验证索引链路（AC-03）和检索链路（AC-04），含失败降级（AC-05），基础设施不可用时优雅跳过 [issue](docs/issues/q-22-rag-real-integration-tests/)
- [closed] q-21 RAG Server E2E — 测试骨架（setup/teardown/mock servers/4 AC），infraAvailable 环境检测自动跳过 [issue](docs/issues/q-21-rag-server-integration-e2e/)
- [closed] q-19 E2E 设置持久化与跨模块用户旅程 — settings-persist.spec.ts（9 AC）+ onboarding-journey.spec.ts（6 AC） [issue](docs/archived/issues/q-19-e2e-settings-journey/)
- [closed] q-18 E2E 聊天 SSE 流式响应与会话管理 — chat-with-rag.spec.ts（9 AC）+ session-management.spec.ts（11 AC） [issue](docs/archived/issues/q-18-e2e-chat-session-specs/)
- [closed] q-16 E2E 基础设施重构 — 删除 Tauri E2E，建立真实 API Web E2E（globalSetup/globalTeardown/fixtures/.env.e2e） [issue](docs/archived/issues/q-16-e2e-infra-migration/)

### docs

- [docs] BACKLOG.md & CHANGELOG.md 同步

---

## [2026-05-29]

### backend

- [closed] b-10 Server 向量与关键词适配 — VectorService 适配 IVectorStore，KeywordService 实现 IKeywordStore（PostgreSQL FTS + zhparser），9 个测试通过 [issue](docs/issues/b-10-server-vector-keyword-adapters/)
- [closed] b-11 文档解析与索引写入 — DocumentParser（MIME 解析，PDF 预留），索引写入由 PrismaVectorIndexer 处理，11 个测试通过 [issue](docs/issues/b-11-document-parser-indexer/)
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

- [closed] d-15 RAG SDK 集成验证 — 5 AC（最小闭环 demo / server 集成点文档 / 覆盖率 97.44%），修复 RecursiveCharacterChunker 无限循环 [issue](docs/archived/issues/d-15-rag-sdk-integration/)
- [closed] d-11 RAG SDK Core 契约层 — 9 AC（types/schema/interfaces/errors/pipeline/vector-store/index），Zod v4 类型推导，12 个测试通过 [issue](docs/archived/issues/d-11-rag-sdk-core-contracts/)
- [closed] d-12 RAG SDK 索引构建模块 — 7 AC（RecursiveCharacterChunker / OpenAIEmbedder / MilvusIndexer / runIndexing），15 个测试通过 [issue](docs/archived/issues/d-12-rag-sdk-indexing-module/)
- [closed] d-13 RAG SDK 在线检索模块 — 9 AC（HybridRetriever / RRF / DefaultRetrievalPostprocessor / SelectionTrace / runRetrievalPipeline），20 个测试通过 [issue](docs/archived/issues/d-13-rag-sdk-runtime-module/)
- [closed] d-14 RAG SDK 可观测性模块 — 6 AC（RAGTracer / consoleObserver / 类型定义），7 个测试通过 [issue](docs/archived/issues/d-14-rag-sdk-observability/)

---

## [2026-05-23]

### backend

- [closed] b-05 ChatController 测试 — 17 AC（SSE 流式响应/abort/持久化/DTO 校验/LLM 异常/E2E 链路），修复 controller 错误提取 [issue](docs/archived/issues/b-05-chat-api-testing/)
- [closed] b-04 KnowledgeBaseController 测试 — 15 AC（list/create/update/delete + DTO 校验 + 多用户隔离） [issue](docs/archived/issues/b-04-knowledge-base-api-testing/)
- [closed] b-03 DocumentController 测试 — 21 AC（upload/create/update/delete/list + DTO 校验 + 文件上传边界 + 权限控制） [issue](docs/archived/issues/b-03-document-api-testing/)
- [closed] b-02 AuthController 测试 — AC-01~AC-15 + E2E 链路 AC-16（public-key/register/login/refresh/logout/me） [issue](docs/archived/issues/b-02-auth-api-testing/)

### frontend

- [closed] f-10 ContextMenu 迁移 — FileManager/FileExplorer/KnowledgeBasePage 内联 ContextMenu 迁移至 overlays/，建立前端 overlay 规范 [issue](docs/archived/issues/f-10-context-menu-and-conventions/)
- [closed] f-09 Dialog 迁移 — FileManager 内联 Dialog + 独立组件迁移至 overlays/ [issue](docs/archived/issues/f-09-dialog-migration/)

---

## [2026-05-22]

### infra

- [closed] i-01 API 测试共享基础设施 — 5 个 helper + vitest 配置 + .env.test [issue](docs/issues/i-01-testing-infra-setup/)

### frontend

- [closed] f-08 Overlay 核心机制 — Dialog/ContextMenu 函数式调用基础设施 [issue](docs/issues/f-08-overlay-core/)

---

## [2026-05-20]

### frontend（已归档）

- [closed] f-19 设置页账户 Tab [归档](docs/archived/issues/f-19-settings-account-tabs/)
- [closed] f-15 TabBar 全局化重构 [归档](docs/archived/issues/f-15-global-tab-bar/)
- [closed] f-16 统一 Tab 类型定义 [归档](docs/archived/issues/f-16-unified-tab-types/)
- [closed] f-17 路由单例标签 [归档](docs/archived/issues/f-17-route-singleton-tabs/)
- [closed] f-18 清理 ChatPage 遗留组件 [归档](docs/archived/issues/f-18-cleanup-chatpage/)

---

## [2026-05-19]

### quality（已归档）

- [closed] q-04 密码传输加密 [归档](docs/archived/issues/q-04-password-transport-encryption/)
- [closed] q-01 安全基线 [归档](docs/archived/issues/q-01-security-baseline/)

---

## [2026-05-18]

### quality/infra（已归档）

- [closed] q-03 V1 清理 [归档](docs/archived/issues/q-03-v1-cleanup/)
- [closed] i-06 数据迁移工具 [归档](docs/archived/issues/i-06-data-migration/)

---

## [2026-05-17]

### backend/infra（已归档）

- [closed] i-07 API 客户端升级 [归档](docs/archived/issues/i-07-api-client/)
- [closed] b-05 设置 API [归档](docs/archived/issues/b-05-settings-api/)
- [closed] b-03 会话 API [归档](docs/archived/issues/b-03-session-api/)
- [closed] b-04 SSE 流式对话 API [归档](docs/archived/issues/b-04-chat-sse-api/)

---

## [2026-05-16]

### infra/design（已归档）

- [closed] i-00 核心接口定义 [归档](docs/archived/issues/i-00-core-interfaces/)
- [closed] i-01 Docker Compose 基础设施 [归档](docs/archived/issues/i-01-docker-compose-infra/)
- [closed] i-02 Prisma 数据模型 [归档](docs/archived/issues/i-02-prisma-setup/)
- [closed] i-08 NestJS 服务器 [归档](docs/archived/issues/i-08-nestjs-server-setup/)
- [closed] i-09 NestJS 认证系统 [归档](docs/archived/issues/i-09-nestjs-auth-system/)
- [closed] i-10 NestJS 安全基线 [归档](docs/archived/issues/i-10-nestjs-security/)
- [closed] i-11 MinIO 服务 [归档](docs/archived/issues/i-11-minio-service/)
- [closed] i-12 Milvus 服务 [归档](docs/archived/issues/i-12-milvus-service/)
- [closed] i-13 BullMQ 服务 [归档](docs/archived/issues/i-13-bullmq-service/)
- [closed] i-14 JWT API 客户端 [归档](docs/archived/issues/i-14-jwt-api-client/)
- [closed] d-01 RAG SDK 合约 [归档](docs/archived/issues/d-01-rag-sdk-contracts/)

---

## [2026-05-15]

### frontend/backend（已归档）

- [closed] f-01 登录/注册页 [归档](docs/archived/issues/f-01-auth-pages/)
- [closed] f-02 路由守卫 [归档](docs/archived/issues/f-02-route-guard/)
- [closed] f-03 侧边栏导航 [归档](docs/archived/issues/f-03-sidebar-navigation/)
- [closed] f-04 聊天页标签栏 [归档](docs/archived/issues/f-04-tab-bar/)
- [closed] f-05 知识库列表 [归档](docs/archived/issues/f-05-knowledge-base-list/)
- [closed] f-06 文件管理器 [归档](docs/archived/issues/f-06-knowledge-base-file-manager/)
- [closed] f-07 文件上传组件 [归档](docs/archived/issues/f-07-file-upload-component/)
- [closed] f-08 文件夹管理 [归档](docs/archived/issues/f-08-folder-management/)
- [closed] f-09 问答对话页 [归档](docs/archived/issues/f-09-chat-page/)
- [closed] f-10 消息渲染器 [归档](docs/archived/issues/f-10-message-renderer/)
- [closed] f-11 知识库选择器 [归档](docs/archived/issues/f-11-kb-selector/)
- [closed] f-12 对话历史 [归档](docs/archived/issues/f-12-chat-history/)
- [closed] f-13 设置页 [归档](docs/archived/issues/f-13-settings-page/)
- [closed] f-14 适配器移除 [归档](docs/archived/issues/f-14-adapter-removal/)
- [closed] b-02 知识库 CRUD API [归档](docs/archived/issues/b-02-knowledge-base-crud-api/)
