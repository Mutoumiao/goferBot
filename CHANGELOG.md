# 完成日志

## [2026-05-28]

- [open] RAG Server 集成 PRD — 定义 server 端 RAG 集成需求：向量/关键词存储适配、文档解析与索引、Worker 队列、Chat RAG 检索、前端 KB 选择器、E2E 验证 [PRD](docs/prd/rag-server-integration.md)
- [open] d-20 SDK Embedder TokenUsage — spec + plan：embedWithUsage 可选接口、TokenUsage 类型、runIndexing 能力检测降级 [issue](docs/issues/d-20-rag-sdk-embedder-token-usage/)
- [open] b-10 Server 向量与关键词适配 — spec + plan：VectorService 适配 SDK IVectorStore、KeywordService 实现 IKeywordStore（PostgreSQL FTS + zhparser 降级）、DocumentService.remove 同步删向量 [issue](docs/issues/b-10-server-vector-keyword-adapters/)
- [open] b-11 文档解析与索引写入 — spec + plan：DocumentParser（MIME 类型解析）、PrismaMilvusIndexer（chunk.id 作为共享主键，消除 milvusId 回写） [issue](docs/issues/b-11-document-parser-indexer/)
- [open] b-08 索引 Worker 集成 — spec + plan：IndexingWorker（BullMQ + runIndexing 流水线）、QueueModule、DocumentJobData 状态机 [issue](docs/issues/b-08-indexing-worker-integration/)
- [open] b-09 Chat RAG 检索 — spec + plan：ChatService.streamChat 手动编排 HybridRetriever + Postprocessor，SSE 流式注入检索上下文 [issue](docs/issues/b-09-chat-rag-retrieval/)
- [open] f-16 前端 Chat KB 选择器 — spec + plan：Chat 页面知识库选择器交互、多选/清空/禁用状态、关联消息级 KB [issue](docs/issues/f-16-chat-kb-selector/)
- [open] q-21 RAG Server E2E — spec + plan：上传→索引→对话检索完整链路 E2E 验证 [issue](docs/issues/q-21-rag-server-integration-e2e/)
- [docs] BACKLOG.md 更新 — 同步 RAG server 集成 issue 状态、E2E 进展、删除重复标题 [BACKLOG](BACKLOG.md)

## [2026-05-27]

- [closed] RAG SDK 集成验证 — 5 AC，覆盖最小闭环 demo / server 集成点文档 / 覆盖率 97.44% / pnpm test & build 通过，修复 RecursiveCharacterChunker 无限循环 bug [issue](docs/issues/d-15-rag-sdk-integration/)
- [closed] RAG SDK Core 契约层 — 9 AC，覆盖 types/schema/interfaces/errors/pipeline/vector-store/index 导出，Zod v4 类型推导，12 个单元测试全部通过 [issue](docs/issues/d-11-rag-sdk-core-contracts/)
- [closed] RAG SDK 索引构建模块 — 7 AC，覆盖 RecursiveCharacterChunker / OpenAIEmbedder / MilvusIndexer / runIndexing pipeline，15 个单元测试全部通过 [issue](docs/issues/d-12-rag-sdk-indexing-module/)
- [closed] RAG SDK 在线检索模块 — 9 AC，覆盖 HybridRetriever / RRF / DefaultRetrievalPostprocessor / SelectionTrace / runRetrievalPipeline，20 个单元测试全部通过 [issue](docs/issues/d-13-rag-sdk-runtime-module/)
- [closed] RAG SDK 可观测性模块 — 6 AC，覆盖 RAGTracer / consoleObserver / 类型定义，7 个单元测试全部通过 [issue](docs/issues/d-14-rag-sdk-observability/)

## [2026-05-23]

- [closed] ChatController 测试 — 模块级集成测试 17 AC，覆盖 SSE 流式响应/格式验证/abort/持久化/DTO 校验/LLM 异常/E2E 完整链路，修复 controller 错误提取 [issue](docs/issues/b-05-chat-api-testing/)
- [closed] KnowledgeBaseController 测试 — 模块级集成测试 15 AC，覆盖 list/create/update/delete 全部端点 + DTO 校验 + 多用户隔离 [issue](docs/issues/b-04-knowledge-base-api-testing/)
- [closed] DocumentController 测试 — 模块级集成测试 21 AC，覆盖 upload/create/update/delete/list 全部端点 + DTO 校验 + 文件上传边界 + 权限控制 [issue](docs/issues/b-03-document-api-testing/)
- [closed] AuthController 测试 — 模块级集成测试 AC-01~AC-15 + E2E 完整链路 AC-16，覆盖 public-key/register/login/refresh/logout/me 全部端点 [issue](docs/issues/b-02-auth-api-testing/)
- [closed] ContextMenu 迁移 — FileManager/FileExplorer/KnowledgeBasePage 内联 ContextMenu 迁移至 overlays/，废弃旧 ContextMenu.vue，建立前端 overlay 规范文档 [issue](docs/issues/f-10-context-menu-and-conventions/)
- [closed] Dialog 迁移 — FileManager 内联 Dialog + 独立组件迁移至 overlays/ [issue](docs/issues/f-09-dialog-migration/)

## [2026-05-22]

- [closed] API 测试共享基础设施 — 5 个 helper + vitest 配置 + .env.test [issue](docs/issues/i-01-testing-infra-setup/)
- [closed] Overlay 核心机制 — 前端 Dialog/ContextMenu 函数式调用基础设施 [issue](docs/issues/f-08-overlay-core/)

## [2026-05-20]

- [closed] 设置页账户 Tab [issue](docs/99-archived/issues/f-19-settings-account-tabs/)
- [closed] TabBar 全局化重构 [issue](docs/99-archived/issues/f-15-global-tab-bar/)
- [closed] 统一 Tab 类型定义 [issue](docs/99-archived/issues/f-16-unified-tab-types/)
- [closed] 路由单例标签 [issue](docs/99-archived/issues/f-17-route-singleton-tabs/)
- [closed] 清理 ChatPage 遗留组件 [issue](docs/99-archived/issues/f-18-cleanup-chatpage/)

## [2026-05-19]

- [closed] 密码传输加密 [issue](docs/99-archived/issues/q-04-password-transport-encryption/)
- [closed] 安全基线 [issue](docs/99-archived/issues/q-01-security-baseline/)

## [2026-05-18]

- [closed] V1 清理 [issue](docs/99-archived/issues/q-03-v1-cleanup/)
- [closed] 数据迁移工具 [issue](docs/99-archived/issues/i-06-data-migration/)

## [2026-05-17]

- [closed] API 客户端升级 [issue](docs/99-archived/issues/i-07-api-client/)
- [closed] 设置 API [issue](docs/99-archived/issues/b-05-settings-api/)
- [closed] 会话 API [issue](docs/99-archived/issues/b-03-session-api/)
- [closed] SSE 流式对话 API [issue](docs/99-archived/issues/b-04-chat-sse-api/)

## [2026-05-16]

- [closed] 核心接口定义 [issue](docs/99-archived/issues/i-00-core-interfaces/)
- [closed] Docker Compose 基础设施 [issue](docs/99-archived/issues/i-01-docker-compose-infra/)
- [closed] Prisma 数据模型 [issue](docs/99-archived/issues/i-02-prisma-setup/)
- [closed] NestJS 服务器 [issue](docs/99-archived/issues/i-08-nestjs-server-setup/)
- [closed] NestJS 认证系统 [issue](docs/99-archived/issues/i-09-nestjs-auth-system/)
- [closed] NestJS 安全基线 [issue](docs/99-archived/issues/i-10-nestjs-security/)
- [closed] MinIO 服务 [issue](docs/99-archived/issues/i-11-minio-service/)
- [closed] Milvus 服务 [issue](docs/99-archived/issues/i-12-milvus-service/)
- [closed] BullMQ 服务 [issue](docs/99-archived/issues/i-13-bullmq-service/)
- [closed] JWT API 客户端 [issue](docs/99-archived/issues/i-14-jwt-api-client/)
- [closed] RAG SDK 合约 [issue](docs/99-archived/issues/d-01-rag-sdk-contracts/)

## [2026-05-15]

- [closed] 登录/注册页 [issue](docs/99-archived/issues/f-01-auth-pages/)
- [closed] 路由守卫 [issue](docs/99-archived/issues/f-02-route-guard/)
- [closed] 侧边栏导航 [issue](docs/99-archived/issues/f-03-sidebar-navigation/)
- [closed] 聊天页标签栏 [issue](docs/99-archived/issues/f-04-tab-bar/)
- [closed] 知识库列表 [issue](docs/99-archived/issues/f-05-knowledge-base-list/)
- [closed] 文件管理器 [issue](docs/99-archived/issues/f-06-knowledge-base-file-manager/)
- [closed] 文件上传组件 [issue](docs/99-archived/issues/f-07-file-upload-component/)
- [closed] 文件夹管理 [issue](docs/99-archived/issues/f-08-folder-management/)
- [closed] 问答对话页 [issue](docs/99-archived/issues/f-09-chat-page/)
- [closed] 消息渲染器 [issue](docs/99-archived/issues/f-10-message-renderer/)
- [closed] 知识库选择器 [issue](docs/99-archived/issues/f-11-kb-selector/)
- [closed] 对话历史 [issue](docs/99-archived/issues/f-12-chat-history/)
- [closed] 设置页 [issue](docs/99-archived/issues/f-13-settings-page/)
- [closed] 适配器移除 [issue](docs/99-archived/issues/f-14-adapter-removal/)
- [closed] 知识库 CRUD API [issue](docs/99-archived/issues/b-02-knowledge-base-crud-api/)
