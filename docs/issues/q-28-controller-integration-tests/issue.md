---
id: q-28
status: closed
track: quality
priority: p1
summary: 补齐 PRD 第一批 Controller 模块级集成测试（Auth/Document/Chat/KB），覆盖所有 error cases。本 issue 是 q-27 的跟进，修复 q-27 交付偏离 PRD 原始目标的问题。
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

为 `docs/prd/api-testing-prd.md` 第一批定义的 4 个 Controller（AuthController、DocumentController、ChatController、KnowledgeBaseController）建立模块级集成测试，覆盖 happy path + 所有 error cases + 边界条件。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 验收标准

- [x] AuthController 模块级集成测试覆盖：register / login / logout / refresh / me / public-key 的所有 error cases（400/401/409）
- [x] DocumentController 模块级集成测试覆盖：upload / create / update / delete / list 的所有 error cases（400/401/403/404/413/415）
- [x] ChatController 模块级集成测试覆盖：SSE 流式响应的 happy path 和错误处理
- [x] KnowledgeBaseController 模块级集成测试覆盖：CRUD + 搜索的所有 error cases（400/401/403/404）
- [x] 全部新增测试在 `pnpm test:integration` 中通过
- [x] 测试数据库零残留，不污染开发环境

## 阻塞于

- q-27（已关闭）— 测试基础设施（TestDatabaseManager、TestAppFactory、AuthFixtures）已就绪

## 范围外

- FolderController、SessionController、SettingsController（PRD 第二批）
- HealthController、全局中间件测试（PRD 第三批）
- HTTP E2E 测试（`tests/e2e/api/` 目录，另开 issue）
- 单元测试（Mock 模式）— q-27 已交付 Service 单元测试骨架

## Agent 简报

**分类：** quality
**摘要：** 补齐 PRD 第一批 4 个 Controller 的模块级集成测试，覆盖所有 error cases。

**当前行为：**
- q-27 交付了 AuthService、KnowledgeBaseService、DocumentService 的单元测试骨架（Mock 模式），但未交付 PRD 要求的 Controller 模块级集成测试
- `tests/integration/` 下现有测试：
  - `auth.spec.ts`：覆盖 401/409/403，但缺少 400 Zod 验证失败、refresh、logout、me 的 error cases
  - `auth-kb-document.spec.ts`：覆盖 Document upload happy path 和 KB 创建，但缺少 Document 的 error cases
  - 无 ChatController 测试
  - 无 KnowledgeBaseController CRUD error cases
- PRD 第一批验收标准 #1"4 个 controller 全部有模块级集成测试，覆盖所有 error cases"未达成

**期望行为：**
- 4 个 Controller 均有独立的 `.spec.ts` 文件
- 每个 Controller 覆盖 PRD 定义的 6 类场景：happy path、Zod 验证失败、认证缺失/无效、资源不存在、唯一约束冲突、速率限制
- 所有测试使用 `TestAppFactory.create()` + `app.inject()` 发起请求
- 所有测试使用独立数据库（`TestDatabaseManager`）

**关键接口：**
- `tests/integration/helpers/test-app.factory.ts` — `TestAppFactory.create(dbUrl)`
- `tests/integration/helpers/test-database.manager.ts` — `createDatabase()` / `dropDatabase()`
- `tests/integration/helpers/auth.fixtures.ts` — `createUser()` / `loginAs()`
- PRD 参考：`docs/prd/api-testing-prd.md` 第一批（第 221-231 行）

**验收标准：**
- [x] AuthController 模块级集成测试覆盖：register / login / logout / refresh / me / public-key 的所有 error cases（400/401/409）
- [x] DocumentController 模块级集成测试覆盖：upload / create / update / delete / list 的所有 error cases（400/401/403/404/413/415）
- [x] ChatController 模块级集成测试覆盖：SSE 流式响应的 happy path 和错误处理
- [x] KnowledgeBaseController 模块级集成测试覆盖：CRUD + 搜索的所有 error cases（400/401/403/404）
- [x] 全部新增测试在 `pnpm test:integration` 中通过
- [x] 测试数据库零残留，不污染开发环境

**范围外：**
- PRD 第二批（Folder/Session/Settings Controller）
- PRD 第三批（Health/全局中间件）
- HTTP E2E 测试
- Service 单元测试（q-27 已完成）
