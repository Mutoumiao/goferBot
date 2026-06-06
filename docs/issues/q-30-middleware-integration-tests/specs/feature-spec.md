---
issue_id: q-30
type: feature-spec
status: draft
summary: 补齐 PRD 第三批全局中间件与 HealthController 模块级集成测试，验证基础设施行为。
---

# 功能规格：PRD 第三批全局中间件与 HealthController 模块级集成测试

## 背景与问题

### PRD 原始目标

`docs/prd/api-testing-prd.md` 明确定义了第三批（低优先级，基础设施验证）：

1. **HealthController** — 简单存活检查
2. **全局中间件测试**
   - `ResponseInterceptor`：验证统一 `{ data: T }` 格式
   - `AllExceptionsFilter`：验证统一 `{ error: { code, message } }` 格式
   - `ZodValidationPipe`：验证字段级错误返回
   - `ThrottlerGuard`：验证 429 响应头和 Retry-After

### 当前测试覆盖状态

当前 `tests/integration/` 下无全局中间件独立验证测试。

**结论**：PRD 第三批基础设施验证**并未完成**。

## 目标

1. 为 HealthController 建立模块级集成测试
2. 为 ResponseInterceptor 建立独立验证测试
3. 为 AllExceptionsFilter 建立独立验证测试
4. 为 ZodValidationPipe 建立独立验证测试
5. 为 ThrottlerGuard 建立独立验证测试

## 边界

### 范围内
- HealthController：`GET /api/health`
- ResponseInterceptor：统一 `{ data: T }` 格式
- AllExceptionsFilter：统一 `{ error: { code, message } }` 格式
- ZodValidationPipe：字段级错误返回
- ThrottlerGuard：429 响应头和 Retry-After
- 使用现有基础设施：`TestAppFactory`、`TestDatabaseManager`

### 范围外
- HTTP E2E 测试
- Service 单元测试
- 业务逻辑变更

## 涉及文件

### 新建测试文件
- `tests/integration/health.controller.spec.ts`
- `tests/integration/response-interceptor.spec.ts`
- `tests/integration/exceptions-filter.spec.ts`
- `tests/integration/zod-validation-pipe.spec.ts`
- `tests/integration/throttler-guard.spec.ts`

### 现有基础设施（复用）
- `tests/integration/helpers/test-app.factory.ts`
- `tests/integration/helpers/test-database.manager.ts`

## 相关功能

- **上游**：q-28（第一批 Controller 集成测试）— 提供测试基础设施和模式参考
- **上游**：`docs/prd/api-testing-prd.md` — 本 issue 的原始需求来源

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 mock 模式（`realMode: false`） | 不依赖外部服务，测试更稳定更快 | 是 |
| 每个中间件独立 `.spec.ts` 文件 | 便于定位失败和维护 | 是 |
| 使用 `app.inject()` 发起请求 | PRD 明确要求 | 否 |
| ThrottlerGuard 测试使用真实限流 | 验证真实行为，不覆盖 NoOpThrottlerGuard | 否 |

## 验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC-01 | `health.controller.spec.ts` 覆盖存活检查 | `pnpm test:integration` 通过 |
| AC-02 | `response-interceptor.spec.ts` 验证统一响应格式 | `pnpm test:integration` 通过 |
| AC-03 | `exceptions-filter.spec.ts` 验证统一异常格式 | `pnpm test:integration` 通过 |
| AC-04 | `zod-validation-pipe.spec.ts` 验证字段级错误 | `pnpm test:integration` 通过 |
| AC-05 | `throttler-guard.spec.ts` 验证 429 响应头 | `pnpm test:integration` 通过 |
| AC-06 | 全部新增测试在 `pnpm test:integration` 中通过 | 运行命令验证 |
| AC-07 | 测试数据库零残留 | `afterAll` 中调用 `dropDatabase` |
