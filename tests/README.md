# 测试文件 → Issue 映射表

维护规则：新增测试文件后，在此文件添加一行映射。

---

## E2E 浏览器测试 (Playwright)

### 单页面功能 (`e2e/specs/`)

| 文件 | 关联 Issue | 覆盖范围 |
|------|-----------|---------|
| `auth.spec.ts` | q-17 | 登录/注册页面元素、成功/失败流程 |
| `chat.spec.ts` | q-14, q-18 | 聊天页面加载、多行输入 |
| `chat-tabs.spec.ts` | f-04 | 标签栏初始、新建、切换、关闭、重命名 |
| `kb-selector.spec.ts` | f-11 | @ 提及下拉、单选/多选、Escape、删除 |
| `knowledge-base.spec.ts` | q-17 | KB 列表、创建、详情、上下文菜单、删除 |
| `session-history.spec.ts` | q-18 | 历史页面、会话列表、恢复、删除、重命名 |
| `settings.spec.ts` | q-19 | 设置页加载、提供商 Tab、切换/保存/错误 |

### 跨模块用户旅程 (`e2e/flows/`)

| 文件 | 关联 Issue | 覆盖范围 |
|------|-----------|---------|
| `settings-persist.spec.ts` | q-19 | 设置保存、刷新恢复、Embedding、温度校验 |
| `onboarding-journey.spec.ts` | q-19 | 注册→KB→文档→会话→AI 响应全旅程 |
| `chat-with-rag.spec.ts` | q-18 | SSE 流式、@ 提及、多选 KB、payload 验证 |
| `session-management.spec.ts` | q-18 | Tab CRUD、历史恢复、删除确认、空状态 |

---

## 集成测试 (`integration/`)

| 文件 | 关联 Issue | 覆盖范围 | 后端依赖 |
|------|-----------|---------|---------|
| `infra.spec.ts` | q-16 | 目录移除、DB/URL/健康检查 | 需要 |
| `auth-flow.spec.ts` | q-17 | 注册/登录成功、错误密码、重定向、重复注册 | 需要 |
| `kb-lifecycle.spec.ts` | q-17 | KB CRUD、文档上传、删除确认、隔离 | 需要 |
| `rag-e2e.spec.ts` | q-21 | 上传→索引→完成→聊天 RAG 全链路 | 需要 |

> 集成测试有 `isBackendAvailable()` 守卫，后端不可用时自动 skip。

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
| `prisma-milvus-indexer.spec.ts` | b-11 | 分块、向量、token 用量、错误场景 |
| `embedder-interfaces.spec.ts` | d-20 | 类型级接口一致性 |
| `openai-embedder-usage.spec.ts` | d-20 | Token 记账、批处理、舍入 |
| `run-indexing-usage.spec.ts` | d-20 | 流水线 token 用量、fallback |

---

## 单元测试 — 前端 (`unit/webui/`)

| 文件 | 关联 Issue | 覆盖范围 |
|------|-----------|---------|
| `KbSelector.spec.ts` | f-16 | 组件渲染、骨架、空状态、错误/重试、键盘导航 |
| `ChatView.spec.ts` | f-16 | 会话切换清除 KB 选择 |
| `ChatInput.spec.ts` | f-16 | KB 选择开关、发送带 KB ID、删除标签 |

---

## 传统单元测试 — 组件/Store/工具函数 (`unit/components/` `unit/stores/` `unit/composables/` `unit/utils/`)

> 以下文件使用 `.test.ts` 后缀，不绑定特定 issue，无 AC-XX 前缀。

| 目录 | 文件数 | 覆盖范围 |
|------|--------|---------|
| `tests/unit/components/` | 24 | ChatMessage, ChatMessageList, ChatInput, EmptySession, KnowledgeBasePage, FileExplorer, SettingsPage, EditKbDialog, MoveCopyDialog, ContextMenu 等 |
| `tests/unit/stores/` | 6 | session, knowledgeBase, settings stores |
| `tests/unit/composables/` | 1 | useSidecarStatus |
| `tests/unit/utils/` | 2 | markdown, confirm |

---

## 图例

| 标记 | 含义 |
|------|------|
| `e2e/specs/` | Playwright 单页面功能，无后端依赖（mock 模式） |
| `e2e/flows/` | Playwright 跨模块旅程，无后端依赖（mock 模式） |
| `integration/` | 真实后端集成测试，有 `isBackendAvailable()` 守卫 |
| `unit/server/` | vitest 后端 issue 验收测试（`.spec.ts`），零外部依赖 |
| `unit/webui/` | vitest 前端 issue 验收测试（`.spec.ts`），零外部依赖 |
| `unit/components/` 等 | vitest 传统单元测试（`.test.ts`），不绑定特定 issue |
