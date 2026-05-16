# Security Baseline — API 规格

> 对应 issue: `q-01-security-baseline`
> 关联: `b-01-auth-api`

---

## 1. 基础信息

- **Base URL**: `http://localhost:3000`（Sidecar 开发端口）
- **Content-Type**: `application/json`
- **认证方式**: Session Cookie（`goferbot.session`）或公开访问
- **CORS**: Origin 白名单，非 `*`，`Access-Control-Allow-Credentials: true`（若保留 CORS）

---

## 2. 全局规范

### 2.1 错误响应统一格式

所有错误响应（4xx / 5xx）使用以下 JSON 结构：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "用户友好的错误信息"
  }
}
```

开发环境可额外返回 `details` 字段辅助调试：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": [
      { "field": "message", "issue": "String must contain at most 4000 character(s)" }
    ]
  }
}
```

### 2.2 错误码汇总

| 状态码 | Code | 含义 | 使用场景 |
|--------|------|------|----------|
| `400` | `VALIDATION_ERROR` | 参数校验失败 | Zod 校验失败、字段缺失、格式错误 |
| `400` | `SSRF_BLOCKED` | SSRF 拦截 | baseUrl 不在白名单或为内网地址 |
| `401` | `AUTH_ERROR` | 认证失败 | 未登录、Session 无效/过期 |
| `403` | `FORBIDDEN` | 禁止访问 | 权限不足（预留） |
| `413` | `PAYLOAD_TOO_LARGE` | 请求体过大 | 文件上传超过 50MB |
| `429` | `RATE_LIMIT_EXCEEDED` | 速率限制 | 请求过于频繁 |
| `500` | `INTERNAL_ERROR` | 服务器内部错误 | 未捕获异常、数据库连接失败 |

### 2.3 速率限制响应头

当触发 `429` 时，响应包含：

```http
Retry-After: 60
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
```

### 2.4 安全响应头

所有响应默认包含：

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains  # 仅生产环境
```

---

## 3. 端点清单

安全基线本身不引入新端点，但为所有现有/未来端点施加安全策略。以下列出受安全基线直接约束的端点：

| 方法 | 路径 | 安全策略 | 认证 |
|------|------|----------|------|
| `GET` | `/health` | 通用限速、安全头 | 否 |
| `POST` | `/chat` | 聊天限速、Zod 校验、SSRF 防护、安全头 | 是（预留） |
| `POST` | `/api/auth/sign-up/email` | 认证限速、Zod 校验（密码策略）、安全头 | 否 |
| `POST` | `/api/auth/sign-in/email` | 认证限速、Zod 校验、安全头 | 否 |
| `POST` | `/api/auth/sign-out` | 认证限速、安全头 | 是 |
| `GET` | `/api/auth/session` | 认证限速、安全头 | 是（Cookie） |
| `GET/POST/PATCH/DELETE` | `/knowledge-bases/**` | 通用限速、Zod 校验、安全头 | 是 |
| `POST` | `/knowledge-bases/:id/documents` | 上传限速、文件大小校验、文件名过滤、安全头 | 是 |
| `GET/POST` | `/settings` | 通用限速、Zod 校验、SSRF 防护（settings 中 baseUrl）、安全头 | 是 |

---

## 4. 端点详情

### 4.1 GET /health

健康检查端点。不暴露敏感信息（数据库连接状态、版本号、环境变量等）。

#### Request

```http
GET /health HTTP/1.1
```

#### Success Response — 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Content-Type-Options: nosniff
X-Frame-Options: DENY

{
  "status": "ok"
}
```

> 仅返回最小化信息。不返回服务器版本、数据库状态、内存使用等。

---

### 4.2 POST /chat

聊天端点。受聊天限速（10 req/min/IP）和 SSRF 防护约束。

#### Request

```http
POST /chat HTTP/1.1
Content-Type: application/json
Cookie: goferbot.session=eyJ...

{
  "message": "你好",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "knowledgeBaseIds": ["7c9e6679-7425-40de-944b-e07fc1f90ae7"],
  "config": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7
  }
}
```

#### 安全相关 Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }` | message 超过 4000 字符或字段非法 |
| `400` | `{ "error": { "code": "SSRF_BLOCKED", "message": "不合法的 API 地址" } }` | config 中 baseUrl 被 SSRF 拦截 |
| `429` | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }` | 超过 10 req/min |

---

### 4.3 POST /knowledge-bases

创建知识库。受通用限速和名称校验约束。

#### Request

```http
POST /knowledge-bases HTTP/1.1
Content-Type: application/json
Cookie: goferbot.session=eyJ...

{
  "name": "我的知识库",
  "description": "用于存储技术文档"
}
```

#### 安全相关 Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }` | name 包含非法字符或长度超限 |

---

### 4.4 POST /knowledge-bases/:id/documents

文件上传。受上传限速、文件大小校验、文件名过滤约束。

#### Request

```http
POST /knowledge-bases/7c9e6679-7425-40de-944b-e07fc1f90ae7/documents HTTP/1.1
Content-Type: multipart/form-data
Cookie: goferbot.session=eyJ...

--boundary
Content-Disposition: form-data; name="file"; filename="report.pdf"

<binary data>
```

#### 安全相关 Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `413` | `{ "error": { "code": "PAYLOAD_TOO_LARGE", "message": "文件大小超过 50MB 限制" } }` | 文件超过 50MB |
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "文件名包含非法字符" } }` | 文件名过滤失败 |
| `429` | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }` | 超过 30 req/min |

---

## 5. 中间件 API 规格

### 5.1 安全头中间件

```typescript
// packages/server/src/middleware/helmet.ts
import { Hono } from 'hono'

export function applyHelmet(app: Hono): void {
  // 使用 hono/helmet 或 helmet 包
  // 配置见 behavior-spec.md 第 1 节
}
```

### 5.2 CORS 中间件

```typescript
// packages/server/src/middleware/cors.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'

export function applyCors(app: Hono): void {
  // 方案 A：不挂载 cors()
  // 方案 B：
  app.use('*', cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:1420',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Cookie'],
    credentials: true,
  }))
}
```

### 5.3 速率限制中间件

```typescript
// packages/server/src/middleware/rate-limit.ts
import { rateLimiter } from 'hono-rate-limiter'
import type { MiddlewareHandler } from 'hono'

interface RateLimitConfig {
  windowMs: number
  limit: number
  keyGenerator?: (c: Context) => string
}

export function createRateLimiter(config: RateLimitConfig): MiddlewareHandler

export const authRateLimit = createRateLimiter({ windowMs: 60_000, limit: 5 })
export const chatRateLimit = createRateLimiter({ windowMs: 60_000, limit: 10 })
export const uploadRateLimit = createRateLimiter({ windowMs: 60_000, limit: 30 })
export const generalRateLimit = createRateLimiter({ windowMs: 60_000, limit: 60 })
```

### 5.4 Zod 校验中间件

```typescript
// packages/server/src/middleware/validate.ts
import { zValidator } from '@hono/zod-validator'
import type { ZodSchema } from 'zod'
import type { MiddlewareHandler } from 'hono'

export function validateBody<T extends ZodSchema>(schema: T): MiddlewareHandler {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求参数校验失败',
          details: process.env.NODE_ENV !== 'production'
            ? result.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))
            : undefined,
        },
      }, 400)
    }
  })
}
```

### 5.5 SSRF 防护工具

```typescript
// packages/server/src/utils/ssrf-guard.ts

export class SSRFError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SSRFError'
  }
}

/**
 * 校验 baseUrl 是否合法。
 * @param baseUrl — 用户配置的 API Base URL
 * @throws SSRFError — 当地址不在白名单或为内网地址时抛出
 */
export function validateBaseUrl(baseUrl: string): void

/** 白名单域名 */
export const ALLOWED_HOSTS = [
  'api.openai.com',
  'api.deepseek.com',
  'api.anthropic.com',
  'localhost:11434',
]
```

### 5.6 错误脱敏工具

```typescript
// packages/server/src/utils/sanitize-error.ts
import type { ErrorHandler } from 'hono'

export const sanitizeError: ErrorHandler = (err, c) => {
  // 映射错误类型到统一响应格式
  // 生产环境隐藏堆栈与内部信息
}
```

---

## 6. Hono 路由挂载示例

在 `packages/server/src/index.ts` 中：

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { helmet } from 'hono/helmet' // 或 import helmet from 'helmet'
import { authRateLimit, chatRateLimit, uploadRateLimit, generalRateLimit } from './middleware/rate-limit.js'
import { sanitizeError } from './utils/sanitize-error.js'

const app = new Hono()

// 1. 全局安全头
app.use('*', helmet({
  contentSecurityPolicy: false, // API 不需要 CSP
  hsts: process.env.NODE_ENV === 'production',
}))

// 2. CORS（方案 B：保留时）
app.use('*', cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:1420',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type', 'Cookie'],
  credentials: true,
}))

// 3. 通用限速（兜底）
app.use('*', generalRateLimit)

// 4. 全局错误处理（脱敏）
app.onError(sanitizeError)

// 5. 认证路由（独立限速覆盖通用限速）
app.use('/api/auth/*', authRateLimit)

// 6. 聊天路由
app.use('/chat', chatRateLimit)

// 7. 上传路由
app.use('/knowledge-bases/:id/documents', uploadRateLimit)

// ... 业务路由挂载
```

---

## 7. 数据模型（安全相关）

### 7.1 日志事件结构

```typescript
interface SecurityLogEvent {
  event: 'auth_failure' | 'auth_success' | 'rate_limit' | 'invalid_input' | 'ssrf_blocked'
  timestamp: string // ISO 8601
  ip: string
  userId?: string
  path?: string
  metadata?: Record<string, unknown>
}
```

### 7.2 限速计数结构（内存 / Redis）

```
key: rate_limit:<ip>:<route_group>
value: <count>
ttl: <windowMs> 毫秒
```

示例：
```
rate_limit:192.168.1.100:auth → 3（已用 3 次，剩余 2 次）
TTL: 45000（窗口剩余 45 秒）
```
