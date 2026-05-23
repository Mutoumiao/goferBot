# 功能规格：HealthController + 全局中间件验证测试

## 用户故事
作为系统运维人员，我希望通过健康检查端点确认服务状态，并确保全局中间件（响应格式化、异常处理、参数校验、速率限制）按预期工作，以便保证 API 的一致性和可靠性。

## 边界

- 范围内：
  - HealthController 的 `GET /health` 端点
  - ResponseInterceptor 的统一 `{ data: T }` 响应格式
  - AllExceptionsFilter 的统一 `{ error: { code, message } }` 异常格式
  - ZodValidationPipe 的字段级校验错误返回
  - ThrottlerGuard 的 429 响应及 Retry-After 头
- 范围外：
  - 前端交互状态（纯后端测试 issue）
  - 具体业务 Controller 的测试（由其他 issue 覆盖）
  - SpiderGuard 的测试（独立 issue）

## 涉及组件

- `HealthController`
- `ResponseInterceptor`
- `AllExceptionsFilter`
- `ZodValidationPipe`
- `ThrottlerGuard`

## 相关功能

- b-06 Folder/Session/Settings 模块级测试 — 已验证 TestAppFactory 模式
- i-01 测试基础设施 — 提供 TestDatabaseManager、AuthFixtures

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 TestAppFactory 创建完整 NestJS 应用（不 mock 中间件） | 需验证真实中间件链行为 | 否 |
| ThrottlerGuard 在测试中使用高 limit 配置（9999）避免干扰 | b-06 已验证共享 app 会导致 429，但本 issue 需测试 429 场景 | 是 |
| 对 ThrottlerGuard 的 429 测试使用独立低 limit 配置 | 需触发真实限流行为 | 否 |
| 429 测试通过动态测试 Controller 触发 | 避免污染生产代码，使用 `@Throttle(1, 60)` 装饰测试端点 | 否 |
| ZodValidationPipe 测试通过动态测试 Controller 触发 | 避免耦合业务模块，使用 `createZodDto` 定义测试 DTO | 否 |
| 本 issue 无 behavior-spec | 纯后端测试 issue，不涉及前端交互状态 | 否 |
