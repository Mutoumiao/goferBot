---
id: b-07
status: closed
track: backend
priority: p3
summary: HealthController + 全局中间件验证测试
blocked_by: ["i-01"]
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

为 HealthController 和全局中间件编写模块级集成测试，验证统一响应格式、异常处理、验证管道、速率限制。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- ResponseInterceptor：验证统一 `{ data: T }` 格式
- AllExceptionsFilter：验证统一 `{ error: { code, message } }` 格式
- ZodValidationPipe：验证字段级错误返回
- ThrottlerGuard：验证 429 响应头和 Retry-After
- 所有请求路径需包含 `/api` 前缀
