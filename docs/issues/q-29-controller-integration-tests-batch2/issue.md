---
id: q-29
status: closed
track: quality
priority: p1
summary: 补齐 PRD 第二批 Controller 模块级集成测试（Session/Settings/Folder），覆盖所有端点和 error cases。
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/api-testing-prd.md
prd_section: 第二批（中优先级，补充覆盖）
---

## 要构建的内容

为 `docs/prd/api-testing-prd.md` 第二批定义的 3 个 Controller（SessionController、SettingsController、FolderController）建立模块级集成测试，覆盖 happy path + 所有 error cases + 边界条件。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## PRD 引用

- **来源 PRD**: `docs/prd/api-testing-prd.md`
- **对应章节**: 第二批（中优先级，补充覆盖）
- **核心目标**: 补齐 SessionController、SettingsController、FolderController 的模块级集成测试，确保所有新增/修改的 API 都有对应测试。
- **验收标准**:
  1. SessionController 模块级集成测试覆盖 CRUD + rename 的所有 error cases
  2. SettingsController 模块级集成测试覆盖 read/write + Zod 验证失败
  3. FolderController 模块级集成测试覆盖 CRUD 的所有 error cases
  4. 全部新增测试在 `pnpm test:integration` 中通过
  5. 测试数据库零残留

## 验收标准

- [x] SessionController 模块级集成测试覆盖：GET /api/sessions、GET /api/sessions/:id、POST /api/sessions、POST /api/sessions/:id/rename、DELETE /api/sessions/:id 的所有 error cases（400/401/403/404）
- [x] SettingsController 模块级集成测试覆盖：GET /api/settings、POST /api/settings 的所有 error cases（400/401）
- [x] FolderController 模块级集成测试覆盖：GET /api/knowledge-bases/:kbId/folders、POST /api/knowledge-bases/:kbId/folders、PATCH /api/knowledge-bases/:kbId/folders/:folderId、DELETE /api/knowledge-bases/:kbId/folders/:folderId 的所有 error cases（400/401/403/404）
- [x] 全部新增测试在 `pnpm test:integration` 中通过
- [x] 测试数据库零残留，不污染开发环境

## 阻塞于

- q-28（已关闭）— 测试基础设施和第一批 Controller 测试已就绪

## 范围外

- HealthController（PRD 第三批）
- 全局中间件测试（PRD 第三批）
- HTTP E2E 测试（另开 issue）
- 单元测试（Mock 模式）

## Agent 简报

**分类：** quality
**摘要：** 补齐 PRD 第二批 3 个 Controller 的模块级集成测试，覆盖所有 error cases。

**当前行为：**
- SessionController、SettingsController、FolderController 无模块级集成测试
- `tests/integration/sessions.test.ts` 和 `settings.test.ts` 是旧 V1 遗留测试（`.test.ts`），非 NestJS 模块级测试
- PRD 第二批验收标准未达成

**期望行为：**
- 3 个 Controller 均有独立的 `.spec.ts` 文件
- 每个 Controller 覆盖 PRD 定义的 6 类场景：happy path、Zod 验证失败、认证缺失/无效、资源不存在、权限不足、边界条件
- 所有测试使用 `TestAppFactory.create()` + `app.inject()` 发起请求
- 所有测试使用独立数据库（`TestDatabaseManager`）

**关键接口：**
- `tests/integration/helpers/test-app.factory.ts` — `TestAppFactory.create(dbUrl)`
- `tests/integration/helpers/test-database.manager.ts` — `createDatabase()` / `dropDatabase()`
- `tests/integration/helpers/auth.fixtures.ts` — `createUser()` / `loginAs()`
- PRD 参考：`docs/prd/api-testing-prd.md` 第二批（第 233-237 行）

**验收标准：**
- [x] SessionController 模块级集成测试覆盖所有端点和 error cases（400/401/403/404）
- [x] SettingsController 模块级集成测试覆盖所有端点和 error cases（400/401）
- [x] FolderController 模块级集成测试覆盖所有端点和 error cases（400/401/403/404）
- [x] 全部新增测试在 `pnpm test:integration` 中通过
- [x] 测试数据库零残留

**范围外：**
- PRD 第三批（Health/全局中间件）
- HTTP E2E 测试
