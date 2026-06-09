# 测试文件 → Issue 映射表

维护规则：新增测试文件后，在此文件添加一行映射。

---

## E2E 浏览器测试 (Playwright)

### 单页面功能 (`e2e/specs/`)

| 文件 | 关联 Issue | 覆盖范围 |
|------|-----------|---------|
| `auth-ui.spec.ts` | q-17 | 🔧 Mock — 页面元素、表单校验、路由跳转 |
| `chat-ui.spec.ts` | q-18 | 🔧 Mock — 聊天页面加载、多行输入（SSE→chat-with-rag） |
| `chat-tabs.spec.ts` | f-04 | 标签栏初始、新建、切换、关闭、重命名 |
| `kb-selector.spec.ts` | f-11 | @ 提及下拉、单选/多选、Escape、删除 |
| `knowledge-base-ui.spec.ts` | q-17 | 🔧 Mock — KB 列表、详情、ContextMenu/Dialog 交互 |
| `session-history.spec.ts` | q-18 | 历史页面、会话列表、恢复、删除、重命名 |
| `settings.spec.ts` | q-19 | 设置页加载、提供商 Tab、切换/保存/错误 |

### 跨模块用户旅程 (`e2e/flows/`)

| 文件 | 关联 Issue | 覆盖范围 |
|------|-----------|---------|
| `settings-persist.spec.ts` | q-19 | 设置保存、刷新恢复、Embedding、温度校验 |
| `onboarding-journey-ui.spec.ts` | q-19 | 🔧 Mock — 路由守卫、页面导航、聊天交互 |
| `chat-with-rag.spec.ts` | q-18 | SSE 流式、@ 提及、多选 KB、payload 验证 |
| `session-management.spec.ts` | q-18 | Tab CRUD、历史恢复、删除确认、空状态 |

---

## 集成测试 (`integration/`)

| 文件 | 关联 Issue | 覆盖范围 | 后端依赖 |
|------|-----------|---------|---------|
| `infra.spec.ts` | q-16 | 目录移除、DB/URL/健康检查 | 需要 |
| `auth.controller.spec.ts` | q-28 | AuthController 全端点 + error cases（25 测试） | 仅 PostgreSQL |
| `document.controller.spec.ts` | q-28 | DocumentController upload/CRUD + error cases（31 测试） | 仅 PostgreSQL |
| `chat.controller.spec.ts` | q-28 | ChatController SSE 流式 + error cases（7 测试） | 仅 PostgreSQL |
| `knowledge-base.controller.spec.ts` | q-28 | KnowledgeBaseController CRUD + 权限隔离（19 测试） | 仅 PostgreSQL |
| `session.controller.spec.ts` | q-29 | SessionController CRUD + rename + error cases（17 测试） | 仅 PostgreSQL |
| `settings.controller.spec.ts` | q-29 | SettingsController read/write + Zod 验证（8 测试） | 仅 PostgreSQL |
| `folder.controller.spec.ts` | q-29 | FolderController CRUD + error cases（18 测试） | 仅 PostgreSQL |
| `health.controller.spec.ts` | q-30 | HealthController 存活检查（2 测试） | 仅 PostgreSQL |
| `response-interceptor.spec.ts` | q-30 | ResponseInterceptor 统一 { data } 格式（4 测试） | 仅 PostgreSQL |
| `exceptions-filter.spec.ts` | q-30 | AllExceptionsFilter 统一 { error } 格式（5 测试） | 仅 PostgreSQL |
| `zod-validation-pipe.spec.ts` | q-30 | ZodValidationPipe 字段级错误（4 测试） | 仅 PostgreSQL |
| `throttler-guard.spec.ts` | q-30 | ThrottlerGuard 429 + Retry-After（3 测试） | 仅 PostgreSQL |
| `admin-user-management.spec.ts` | b-14 | Admin 用户列表/状态管理（8 测试） | 仅 PostgreSQL |
| `pgvector-store.spec.ts` | b-12 | PgVectorStore CRUD、维度校验、idempotent | 需要 |
| `vector-service.spec.ts` | b-10 | VectorService 委托 PgVectorStore 验证 | 需要 |
| `prisma-vector-indexer.spec.ts` | b-13 | 单事务写入、token 用量、重试、接口 | 需要 |
| `rag-e2e.spec.ts` | q-21 | 上传→索引→完成→聊天 RAG 全链路 | 需要完整基础设施 |
| `rag-real.spec.ts` | q-22 | ✅ 真实 API — 索引链路/检索链路/失败降级 | 需要完整基础设施 |

> 集成测试分层：
> - **模块级集成测试**：使用 `TestAppFactory.create(dbUrl)` + `app.inject()`，每个 Controller 独立 `.spec.ts`，覆盖 happy path + error cases + 边界条件，仅依赖 PostgreSQL
> - **真实模式测试**（`rag-real.spec.ts` 等）：需要完整基础设施（PostgreSQL + pgvector + Redis + MinIO），通过 `checkInfrastructure()` 检测可用性，不可用时跳过

---

## 单元测试 — 后端 (`unit/server/`)

| 文件 | 关联 Issue | 覆盖范围 |
|------|-----------|---------|
| `indexing-worker.spec.ts` | b-08 | 索引流水线、阶段变更、未找到、失败处理 |
| `queue.service.spec.ts` | b-08 | 任务入队、状态查询 |
| `queue.module.spec.ts` | b-08 | 模块注册检查 |
| `document.service.spec.ts` | b-08 | 上传触发索引任务 |
| `chat-rag.spec.ts` | b-09 | RAG 检索、Schema 验证、回退、SSE 格式 |
| `vector-service.spec.ts` | b-10 | 向量增删查、过滤 |
| `keyword-service.spec.ts` | b-10 | 关键字搜索、过滤、边界 |
| `document-service.spec.ts` | b-10 | 文档删除联动向量清理 |
| `document-parser.spec.ts` | b-11 | txt/md 解析、PDF 抛错、fallback |
| `prisma-vector-indexer.spec.ts` | b-13 | 单事务写入 chunks + embedding、token 用量、重试 |
| `embedder-interfaces.spec.ts` | d-20 | 类型级接口一致性 |
| `openai-embedder-usage.spec.ts` | d-20 | Token 记账、批处理、舍入 |
| `run-indexing-usage.spec.ts` | d-20 | 流水线 token 用量、fallback |

---

## 单元测试 — 前端 (`unit/web/`)

> 前端单元测试已迁移至 `packages/web/tests/`（与源码同目录）。以下历史文件位于 `tests/unit/webui/`，已冻结不再维护。

| 文件 | 关联 Issue | 覆盖范围 | 状态 |
|------|-----------|---------|------|
| `KbSelector.spec.ts` | f-16 | 组件渲染、骨架、空状态、错误/重试、键盘导航 | 已冻结 |
| `ChatView.spec.ts` | f-16 | 会话切换清除 KB 选择 | 已冻结 |
| `ChatInput.spec.ts` | f-16 | KB 选择开关、发送带 KB ID、删除标签 | 已冻结 |

---

## 图例

| 标记 | 含义 |
|------|------|
| `🔧 Mock` | E2E Mock 模式 — 验证 UI 渲染、交互、路由，不验证后端契约 |
| `✅ 真实 API` | 使用真实后端 API，验证端到端契约和数据持久化 |
| `e2e/specs/` | Playwright 单页面功能，mock 模式下无后端依赖 |
| `e2e/flows/` | Playwright 跨模块旅程，mock 模式下无后端依赖 |
| `integration/` | 真实后端集成测试，通过 `checkInfrastructure()` 优雅跳过 |
| `unit/server/` | vitest 后端 issue 验收测试（`.spec.ts`），零外部依赖 |
| `packages/web/tests/` | vitest 前端 issue 验收测试（React），零外部依赖 |
