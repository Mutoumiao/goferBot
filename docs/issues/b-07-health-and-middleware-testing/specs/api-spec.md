# API 规格：HealthController + 全局中间件验证

## 端点

### GET /api/health

#### 认证
无需认证（公开端点）

#### 请求
无

#### 响应 200
```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-05-23T12:00:00.000Z",
    "version": "0.1.0"
  }
}
```

> 注意：由 ResponseInterceptor 包装为 `{ data: T }` 格式。

---

## 全局中间件行为规格

### ResponseInterceptor

所有成功响应（未被 `@BypassResponse()` 标记的 handler）必须包装为：
```json
{ "data": <原始返回值> }
```

若 handler 返回 `undefined`，响应体为 `{ "data": null }`。

### AllExceptionsFilter

所有异常响应必须统一为：
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

开发环境（`NODE_ENV=development`）下额外包含 `details` 和 `stack`。

状态码映射：

| HTTP 状态 | code |
|-----------|------|
| 400 | `VALIDATION_ERROR` |
| 401 | `AUTH_ERROR` |
| 404 | `NOT_FOUND` |
| 429 | `RATE_LIMIT_EXCEEDED` |
| 500 | `INTERNAL_ERROR` |

### ZodValidationPipe

校验失败时返回 400，响应体：
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": [
      { "field": "fieldName", "issue": "错误描述" }
    ]
  }
}
```

### ThrottlerGuard

触发限流时返回 429。

响应体：
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "ThrottlerException: Too Many Requests"
  }
}
```

> 注：`Retry-After` 响应头取决于 ThrottlerModule 的存储实现，测试环境中不保证返回。

---

## 测试实现说明

### AC-04（ZodValidationPipe）
在测试中动态注册一个测试 Controller，使用 `createZodDto` 定义带校验规则的 DTO，通过发送非法 payload 触发 `BadRequestException`，验证响应体包含 `error.code = "VALIDATION_ERROR"` 及 `error.details` 字段级错误数组。

### AC-05（ThrottlerGuard）
在测试中动态注册一个测试 Controller，在方法上添加 `@Throttle(1, 60)`（1 分钟内限 1 次），连续请求两次验证第二次返回 429。

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| Health 200 | `tests/issues/b-07-health-and-middleware-testing/health.spec.ts` | `AC-01: returns health status with data wrapper` |
| ResponseInterceptor data 包装 | `tests/issues/b-07-health-and-middleware-testing/health.spec.ts` | `AC-02: wraps response in data field` |
| AllExceptionsFilter 异常格式 | `tests/issues/b-07-health-and-middleware-testing/exception.spec.ts` | `AC-03: returns structured error for unknown route` |
| ZodValidationPipe 400 | `tests/issues/b-07-health-and-middleware-testing/validation.spec.ts` | `AC-04: returns 400 with field-level errors` |
| ThrottlerGuard 429 | `tests/issues/b-07-health-and-middleware-testing/throttle.spec.ts` | `AC-05: returns 429 on rate limit` |
