---
id: q-30
status: closed
track: quality
priority: p1
summary: 补齐 PRD 第三批全局中间件与 HealthController 模块级集成测试，验证统一响应格式、异常处理、限流等基础设施行为。
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/api-testing-prd.md
prd_section: 第三批（低优先级，基础设施验证）
---

## 要构建的内容

为 `docs/prd/api-testing-prd.md` 第三批定义的全局中间件和 HealthController 建立模块级集成测试，验证基础设施行为的正确性。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## PRD 引用

- **来源 PRD**: `docs/prd/api-testing-prd.md`
- **对应章节**: 第三批（低优先级，基础设施验证）
- **核心目标**: 验证 ResponseInterceptor、AllExceptionsFilter、ZodValidationPipe、ThrottlerGuard 的行为符合架构决策，HealthController 提供存活检查。
- **验收标准**:
  1. HealthController 简单存活检查
  2. ResponseInterceptor 验证统一 `{ data: T }` 格式
  3. AllExceptionsFilter 验证统一 `{ error: { code, message } }` 格式
  4. ZodValidationPipe 验证字段级错误返回
  5. ThrottlerGuard 验证 429 响应头和 Retry-After

## 验收标准

- [x] HealthController 模块级集成测试：`GET /api/health` 返回 200 和状态信息
- [x] ResponseInterceptor 测试：验证所有成功响应统一包装为 `{ data: T }` 格式
- [x] AllExceptionsFilter 测试：验证所有异常响应统一包装为 `{ error: { code, message } }` 格式
- [x] ZodValidationPipe 测试：验证 Zod 验证失败返回 400 和字段级错误信息
- [x] ThrottlerGuard 测试：验证速率限制返回 429 和 `Retry-After` 响应头
- [x] 全部新增测试在 `pnpm test:integration` 中通过
- [x] 测试数据库零残留

## 阻塞于

- q-28（已关闭）— 测试基础设施已就绪
- q-29（待实施）— 第二批 Controller 测试完成后，基础设施更稳定

## 范围外

- HTTP E2E 测试
- Service 单元测试
- 业务逻辑变更

## Agent 简报

**分类：** quality
**摘要：** 补齐 PRD 第三批全局中间件与 HealthController 模块级集成测试。

**当前行为：**
- HealthController 无模块级集成测试
- ResponseInterceptor、AllExceptionsFilter、ZodValidationPipe、ThrottlerGuard 无独立验证
- PRD 第三批验收标准未达成

**期望行为：**
- HealthController 有独立的 `.spec.ts` 文件
- 每个全局中间件有独立的验证测试
- 所有测试使用 `TestAppFactory.create()` + `app.inject()` 发起请求

**关键接口：**
- `tests/integration/helpers/test-app.factory.ts` — `TestAppFactory.create(dbUrl)`
- `tests/integration/helpers/test-database.manager.ts` — `createDatabase()` / `dropDatabase()`
- PRD 参考：`docs/prd/api-testing-prd.md` 第三批（第 239-246 行）

**验收标准：**
- [x] HealthController 存活检查测试
- [x] ResponseInterceptor 统一响应格式测试
- [x] AllExceptionsFilter 统一异常格式测试
- [x] ZodValidationPipe 字段级错误测试
- [x] ThrottlerGuard 429 响应头测试
- [x] 全部新增测试在 `pnpm test:integration` 中通过
- [x] 测试数据库零残留

**范围外：**
- HTTP E2E 测试
- 业务逻辑变更
