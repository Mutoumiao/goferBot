---
issue_id: q-28
type: feature-spec
status: draft
summary: 补齐 PRD 第一批 4 个 Controller（Auth/Document/Chat/KB）的模块级集成测试，覆盖 happy path + 所有 error cases + 边界条件。本 issue 修复 q-27 交付偏离 PRD 原始目标的问题。
---

# 功能规格：PRD 第一批 Controller 模块级集成测试补齐

## 背景与问题

### PRD 原始目标

`docs/prd/api-testing-prd.md` 于 2026-06-05 定稿，明确定义了两层测试体系：

| 层级 | 技术 | 数据库 | 必做规则 |
|------|------|--------|----------|
| **模块级集成测试** | `@nestjs/testing` + Fastify `app.inject()` | 真实 PG（每文件独立数据库） | **每个新增/修改的 API 必须写** |
| HTTP E2E | `axios` + 真实 NestJS 进程 | 真实 PG（共享测试库，每例清理） | 核心链路必须写 |

PRD 第一批（高优先级，核心缺口）明确要求：

1. **AuthController** — register / login / logout / refresh / me / public-key
   - 密码 RSA-OAEP 加密、JWT 签发与验证、邮箱唯一性约束、RSA 公钥获取
   - error cases：400（Zod 验证失败）、401（无效 token）、409（邮箱已存在）
2. **DocumentController** — upload / create / update / delete / list
   - multipart/form-data 上传、50MB 限制、MIME 类型校验、MinIO 真实存储
3. **ChatController** — SSE 流式响应
   - 流式输出格式、客户端断开处理、abort 逻辑、消息持久化
4. **KnowledgeBaseController** — CRUD + 搜索
   - 旧测试存在但需 NestJS 模块级重写，补充认证隔离和分页

### q-27 交付偏差

q-27（后端测试覆盖率门槛定义与核心模块测试补齐）于 2026-06-06 关闭，但交付内容与 PRD 第一批目标不一致：

| PRD 要求 | q-27 实际交付 | 状态 |
|----------|--------------|------|
| AuthController 模块级集成测试 | AuthService 单元测试骨架（Mock） | ❌ 缺失 |
| DocumentController 模块级集成测试 | DocumentService 单元测试骨架（Mock） | ❌ 缺失 |
| ChatController 模块级集成测试 | 无 | ❌ 缺失 |
| KnowledgeBaseController 模块级集成测试 | KnowledgeBaseService 单元测试骨架（Mock） | ❌ 缺失 |

**根本原因**：q-27 的 issue 定义（`docs/issues/q-27-backend-coverage-threshold/issue.md`）仅要求"为 AuthModule、KnowledgeBaseModule 建立单元测试骨架（Mock 模式）"，未引用 PRD 第一批的 Controller 集成测试要求。Plan 生成时也未对齐 PRD 目标，导致执行偏离。

### 现有测试覆盖状态

当前 `tests/integration/` 下已有测试：

| 文件 | 覆盖内容 | 缺口 |
|------|----------|------|
| `auth.spec.ts` | 401（未登录访问）、409（重复注册）、403（禁用用户登录） | 缺少：400 Zod 验证失败、refresh、logout、me error cases |
| `auth-kb-document.spec.ts` | 上传 happy path（txt/md/pdf）、KB 创建 | 缺少：Document error cases（400/413/415）、KB CRUD error cases |
| `admin-user-management.spec.ts` | Admin 用户管理 | 与本 issue 无关 |
| `infra.spec.ts` 等 | 基础设施测试 | 与本 issue 无关 |

**结论**：PRD 第一批 4 个 Controller 的模块级集成测试**并未完成**，需要本 issue 补齐。

## 目标

1. 为 AuthController 建立完整的模块级集成测试，覆盖所有端点和 error cases
2. 为 DocumentController 建立完整的模块级集成测试，覆盖所有端点和 error cases（含 multipart 上传）
3. 为 ChatController 建立模块级集成测试，覆盖 SSE 流式响应
4. 为 KnowledgeBaseController 建立完整的模块级集成测试，覆盖 CRUD + 搜索
5. 所有测试符合 PRD 定义的模块级测试标准模板（6 类场景）

## 边界

### 范围内
- AuthController：register / login / logout / refresh / me / public-key
- DocumentController：upload / create / update / delete / list
- ChatController：SSE 流式响应（POST /chat）
- KnowledgeBaseController：list / create / update / delete
- 5 类测试场景：happy path、Zod 验证失败、认证缺失/无效、资源不存在、唯一约束冲突
- 使用现有基础设施：`TestAppFactory`、`TestDatabaseManager`、`AuthFixtures`

### 范围外
- PRD 第二批：FolderController、SessionController、SettingsController
- PRD 第三批：HealthController、全局中间件测试（ResponseInterceptor、AllExceptionsFilter、ZodValidationPipe、ThrottlerGuard）
- HTTP E2E 测试（`tests/e2e/api/`）
- Service 单元测试（q-27 已完成）
- 真实模式测试（需要 MinIO/Milvus/Redis）— 使用 mock 模式（`realMode: false`）
- **速率限制测试（429）**：当前 `TestAppFactory` 使用 `NoOpThrottlerGuard` 放行所有请求，速率限制场景在第三批全局中间件测试中覆盖
- **MinIO 真实存储验证**：multipart 上传协议由 mock 模式覆盖，真实 MinIO 存储行为由 HTTP E2E 测试覆盖

## 涉及文件

### 新建测试文件
- `tests/integration/auth.controller.spec.ts`
- `tests/integration/document.controller.spec.ts`
- `tests/integration/chat.controller.spec.ts`
- `tests/integration/knowledge-base.controller.spec.ts`

### 现有基础设施（复用）
- `tests/integration/helpers/test-app.factory.ts`
- `tests/integration/helpers/test-database.manager.ts`
- `tests/integration/helpers/auth.fixtures.ts`
- `vitest.integration.config.ts`

## 相关功能

- **上游**：q-24（单元测试数据库隔离治理）— 提供 `testglobals.ts` 数据库保护
- **上游**：q-25（集成测试数据库隔离统一化）— 提供 `TestDatabaseManager` 和独立数据库模式
- **上游**：q-26（E2E 测试数据库清理）— 提供数据库清理机制参考
- **上游**：q-27（后端测试覆盖率门槛）— 提供 Service 单元测试骨架和覆盖率配置
- **上游**：`docs/prd/api-testing-prd.md` — 本 issue 的原始需求来源
- **下游**：q-29（待定）— HTTP E2E API 测试，依赖本 issue 的 Controller 测试作为基础

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 mock 模式（`realMode: false`） | 不依赖 MinIO/Milvus/Redis，测试更稳定更快 | 是，后续可添加真实模式测试 |
| 每个 Controller 独立 `.spec.ts` 文件 | 与 PRD 目录结构一致，便于并行开发和维护 | 是 |
| 使用 `app.inject()` 发起请求 | PRD 明确要求，比 supertest 更贴合 Fastify 适配器 | 否，这是项目标准 |
| 每个文件独立数据库 | q-25 已建立的标准模式，100% 隔离 | 否，这是项目标准 |
| 速率限制测试移至第三批 | `TestAppFactory` 使用 `NoOpThrottlerGuard`，无法测试 429 场景 | 是，若未来修改 TestAppFactory 支持可选启用 ThrottlerGuard |
| 采用扁平目录结构 | 与现有 `tests/integration/*.spec.ts` 保持一致，避免混合风格 | 是，第二批实施时统一迁移至 PRD 目录结构 |

## 验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC-01 | `auth.controller.spec.ts` 覆盖 register/login/logout/refresh/me/public-key 的所有 error cases | `pnpm test:integration` 通过 |
| AC-02 | `document.controller.spec.ts` 覆盖 upload/create/update/delete/list 的所有 error cases | `pnpm test:integration` 通过 |
| AC-03 | `chat.controller.spec.ts` 覆盖 SSE 流式响应的 happy path 和错误处理 | `pnpm test:integration` 通过 |
| AC-04 | `knowledge-base.controller.spec.ts` 覆盖 CRUD + 搜索的所有 error cases | `pnpm test:integration` 通过 |
| AC-05 | 全部新增测试在 `pnpm test:integration` 中通过 | 运行命令验证 |
| AC-06 | 测试数据库零残留 | `afterAll` 中调用 `dropDatabase` |
