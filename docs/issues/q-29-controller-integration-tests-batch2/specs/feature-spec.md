---
issue_id: q-29
type: feature-spec
status: draft
summary: 补齐 PRD 第二批 3 个 Controller（Session/Settings/Folder）的模块级集成测试，覆盖 happy path + 所有 error cases + 边界条件。
---

# 功能规格：PRD 第二批 Controller 模块级集成测试补齐

## 背景与问题

### PRD 原始目标

`docs/prd/api-testing-prd.md` 明确定义了第二批（中优先级，补充覆盖）：

1. **FolderController** — CRUD
2. **SessionController** — CRUD + rename（旧测试存在，需 NestJS 模块级重写）
3. **SettingsController** — read / write（旧测试存在，需 NestJS 模块级重写，补充 Zod 验证失败测试）

### 当前测试覆盖状态

当前 `tests/integration/` 下已有测试：

| 文件 | 覆盖内容 | 状态 |
|------|----------|------|
| `sessions.test.ts` | 旧 V1 遗留测试 | ❌ 非 NestJS 模块级测试 |
| `settings.test.ts` | 旧 V1 遗留测试 | ❌ 非 NestJS 模块级测试 |
| 无 FolderController 测试 | — | ❌ 完全缺失 |

**结论**：PRD 第二批 3 个 Controller 的模块级集成测试**并未完成**。

## 目标

1. 为 SessionController 建立完整的模块级集成测试
2. 为 SettingsController 建立完整的模块级集成测试
3. 为 FolderController 建立完整的模块级集成测试
4. 所有测试符合 PRD 定义的模块级测试标准模板（6 类场景）

## 边界

### 范围内
- SessionController：list / getById / create / rename / delete
- SettingsController：get / update
- FolderController：list / create / update / delete
- 6 类测试场景：happy path、Zod 验证失败、认证缺失/无效、资源不存在、权限不足、边界条件
- 使用现有基础设施：`TestAppFactory`、`TestDatabaseManager`、`AuthFixtures`

### 范围外
- PRD 第三批：HealthController、全局中间件测试
- HTTP E2E 测试
- Service 单元测试

## 涉及文件

### 新建测试文件
- `tests/integration/session.controller.spec.ts`
- `tests/integration/settings.controller.spec.ts`
- `tests/integration/folder.controller.spec.ts`

### 现有基础设施（复用）
- `tests/integration/helpers/test-app.factory.ts`
- `tests/integration/helpers/test-database.manager.ts`
- `tests/integration/helpers/auth.fixtures.ts`

## 相关功能

- **上游**：q-28（第一批 Controller 集成测试）— 提供测试基础设施和模式参考
- **上游**：`docs/prd/api-testing-prd.md` — 本 issue 的原始需求来源

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 mock 模式（`realMode: false`） | 不依赖外部服务，测试更稳定更快 | 是 |
| 每个 Controller 独立 `.spec.ts` 文件 | 与 q-28 保持一致，便于并行开发和维护 | 是 |
| 使用 `app.inject()` 发起请求 | PRD 明确要求，比 supertest 更贴合 Fastify 适配器 | 否 |
| 每个文件独立数据库 | q-25 已建立的标准模式，100% 隔离 | 否 |

## 验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC-01 | `session.controller.spec.ts` 覆盖所有端点和 error cases | `pnpm test:integration` 通过 |
| AC-02 | `settings.controller.spec.ts` 覆盖所有端点和 error cases | `pnpm test:integration` 通过 |
| AC-03 | `folder.controller.spec.ts` 覆盖所有端点和 error cases | `pnpm test:integration` 通过 |
| AC-04 | 全部新增测试在 `pnpm test:integration` 中通过 | 运行命令验证 |
| AC-05 | 测试数据库零残留 | `afterAll` 中调用 `dropDatabase` |
