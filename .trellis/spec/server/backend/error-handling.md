# Error Handling Guidelines

> GoferBot 后端错误处理约定

---

## Two-Tier Error Architecture

GoferBot 使用**双层错误体系**，区分 HTTP 边界错误和内部层错误：

```
HTTP Boundary (User-facing)
┌──────────────────────────┐
│  AppException            │  extends HttpException
│  - code: string          │  → AllExceptionsFilter 统一捕获
│  - message: string       │  → 返回 { success, error, meta }
│  - status: number        │
│  - details?: object      │
└──────────────────────────┘
          ↑
    Factory Functions
    (auth/errors.ts, user/errors.ts)

Internal Layer (Repository/Service)
┌──────────────────────────┐
│  RepositoryError         │  extends Error (NOT HttpException)
│  - NotFoundError         │  → 不应直接暴露给客户端
│  - ConflictError         │  → Service 层负责转换为 AppException
│  - ValidationError       │
│  - StorageError          │
│  - VectorStoreError      │
│  - AuthError             │
└──────────────────────────┘
```

---

## AppException — HTTP Boundary Error

```typescript
// lib/app-error.ts
export class AppException extends HttpException {
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(code: string, message: string, status: number = 500, details?: Record<string, unknown>)
}
```

**返回格式**:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "用户可读的错误消息"
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-07-02T00:00:00.000Z"
  }
}
```

---

## Factory Function Pattern

所有领域错误通过**工厂函数**创建，而非直接 `new AppException()`：

```typescript
// auth/errors.ts — 认证领域
export function invalidCredentialsError(): AppException {
  return new AppException('AUTH_INVALID_CREDENTIALS', '邮箱或密码错误', 401)
}
export function tokenReplayError(): AppException {
  return new AppException('TOKEN_REPLAY', '检测到令牌重放攻击，会话已撤销', 401)
}

// user/errors.ts — 用户领域
export function userNotFoundError(): AppException {
  return new AppException('USER_NOT_FOUND', '用户不存在', 404)
}
export function emailAlreadyExistsError(): AppException {
  return new AppException('EMAIL_EXISTS', '邮箱已被注册', 409)
}
```

**规则**:
- 每个 `errors.ts` 对应一个领域模块（auth、user）
- 函数名描述错误语义，参数明确（如 `validationError(message: string)`）
- 错误码格式：`UPPER_SNAKE_CASE`
- HTTP 状态码与错误语义匹配（401 Auth / 403 Forbidden / 404 Not Found / 409 Conflict）
- 不要在 Service 中直接 `new AppException()`——统一走工厂函数

---

## AllExceptionsFilter — 全局异常过滤器

```typescript
// common/filters/all-exception.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    // 1. AppException → 使用其 code + message
    // 2. HttpException → 映射 status → code
    // 3. Error → INTERNAL_ERROR, 隐藏 message (生产模式)
  }
}
```

**处理逻辑**:

| 异常类型 | code | message | details | 日志级别 |
|---------|------|---------|---------|---------|
| `AppException` | `exception.code` | `exception.getResponse().error.message` | 仅开发模式 | warn |
| `HttpException`（非 AppException） | `mapStatusToCode(status)` | `exception.message` | 仅开发模式 | warn |
| `Error` | `INTERNAL_ERROR` | "服务器内部错误" | 开发模式: `exception.message` | **error**（含 stack） |

**Status → Code 映射**:

| Status | Code |
|--------|------|
| 400 | VALIDATION_ERROR |
| 401 | AUTH_ERROR |
| 403 | FORBIDDEN |
| 404 | NOT_FOUND |
| 409 | CONFLICT |
| 413 | PAYLOAD_TOO_LARGE |
| 422 | VALIDATION_ERROR |
| 429 | RATE_LIMIT_EXCEEDED |
| 500 | INTERNAL_ERROR |

---

## 安全原则

1. **生产模式不暴露 details**：`process.env.NODE_ENV !== 'development'` 时，`details` 字段不返回
2. **5xx 日志含 stack**：`logger.error()` 记录完整堆栈用于排查
3. **OPTIONS 请求短路**：CORS 预检请求直接返回 200，不记录日志
4. **requestId 全链路**：每个错误响应都包含 `meta.requestId`，来自 `RequestIdMiddleware`

---

## 不要做的事

- ❌ 在 Service 中直接 `throw new HttpException()` — 用 AppException 工厂函数
- ❌ 在 Controller 中 try-catch 吞掉异常 — 让 AllExceptionsFilter 统一处理
- ❌ 把 `RepositoryError` 直接暴露给客户端 — Service 层转换为 AppException
- ❌ 在错误消息中暴露数据库细节、SQL 语句、堆栈信息
- ❌ 使用不存在的 HTTP 状态码（如 499）

## Common Mistakes

1. **忘记返回 requestId**：自定义 ExceptionFilter 必须包含 `meta.requestId`
2. **直接比较 error.code**：某些异常通过 `exception.getResponse()` 获取 code，不是 `exception.code`
3. **硬编码 details**：敏感信息（如 email hash）在工厂函数中隐去，不要在 details 中传递原始值
