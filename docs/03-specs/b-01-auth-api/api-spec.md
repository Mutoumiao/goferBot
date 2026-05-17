---
issue_id: b-01-auth-api
type: api-spec
status: draft
summary: 4个认证端点：邮箱注册 POST /sign-up/email、邮箱登录 POST /sign-in/email、登出 POST /sign-out、会话查询 GET /session，基于 Session Cookie 认证，统一错误响应格式。
---
# Auth System — API 规格

> 对应 issue: `b-01-auth-api`
> 关联: `q-01-security-baseline`

---

## 1. 基础信息

- **Base URL**: `http://localhost:3000`（Sidecar 开发端口）
- **Content-Type**: `application/json`
- **认证方式**: Session Cookie (`goferbot.session`)
- **CORS**: 若启用，`Access-Control-Allow-Credentials: true` + 明确 Origin

---

## 2. 端点清单

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/api/auth/sign-up/email` | 邮箱注册 | 否 |
| `POST` | `/api/auth/sign-in/email` | 邮箱登录 | 否 |
| `POST` | `/api/auth/sign-out` | 登出 | 是（Cookie） |
| `GET` | `/api/auth/session` | 获取当前会话 | 是（Cookie） |

---

## 3. 端点详情

### 3.1 POST /api/auth/sign-up/email

用户注册。

#### Request

```http
POST /api/auth/sign-up/email HTTP/1.1
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "Alice"
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `email` | string | 是 | 合法邮箱格式 |
| `password` | string | 是 | 长度 ≥ 8 |
| `name` | string | 否 | 长度 1-50 |

#### Success Response — 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: goferbot.session=eyJ...; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800

{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Alice",
    "avatar": null,
    "createdAt": "2026-05-16T08:00:00.000Z"
  },
  "session": {
    "id": "session-uuid",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2026-05-23T08:00:00.000Z"
  }
}
```

#### Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": "Invalid request body" }` | 字段缺失或格式非法 |
| `400` | `{ "error": "Password must be at least 8 characters" }` | 密码强度不足 |
| `409` | `{ "error": "Email already registered" }` | 邮箱已存在 |
| `429` | `{ "error": "Too many requests, please try again later" }` | 触发速率限制 |
| `500` | `{ "error": "Internal server error" }` | 服务器内部错误 |

---

### 3.2 POST /api/auth/sign-in/email

用户登录。

#### Request

```http
POST /api/auth/sign-in/email HTTP/1.1
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `email` | string | 是 | 合法邮箱格式 |
| `password` | string | 是 | 非空 |

#### Success Response — 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: goferbot.session=eyJ...; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800

{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Alice",
    "avatar": null,
    "createdAt": "2026-05-16T08:00:00.000Z"
  },
  "session": {
    "id": "new-session-uuid",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2026-05-23T08:00:00.000Z"
  }
}
```

> 每次登录创建新 session（session 轮换）。

#### Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": "Invalid request body" }` | 字段缺失或格式非法 |
| `401` | `{ "error": "Invalid email or password" }` | 邮箱不存在或密码错误（不区分） |
| `429` | `{ "error": "Too many requests, please try again later" }` | 触发速率限制 |
| `500` | `{ "error": "Internal server error" }` | 服务器内部错误 |

---

### 3.3 POST /api/auth/sign-out

用户登出，销毁当前 session。

#### Request

```http
POST /api/auth/sign-out HTTP/1.1
Cookie: goferbot.session=eyJ...
```

#### Success Response — 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: goferbot.session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0

{
  "success": true
}
```

> 即使 Cookie 无效或已过期，也返回 200 并清除 Cookie（幂等）。

#### Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `429` | `{ "error": "Too many requests, please try again later" }` | 触发速率限制 |
| `500` | `{ "error": "Internal server error" }` | 服务器内部错误 |

---

### 3.4 GET /api/auth/session

查询当前会话。未登录时返回 `null`（不抛 401）。

#### Request

```http
GET /api/auth/session HTTP/1.1
Cookie: goferbot.session=eyJ...
```

#### Success Response — 200 OK（已登录）

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Alice",
    "avatar": null,
    "createdAt": "2026-05-16T08:00:00.000Z"
  },
  "session": {
    "id": "session-uuid",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2026-05-23T08:00:00.000Z"
  }
}
```

#### Success Response — 200 OK（未登录）

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "user": null,
  "session": null
}
```

#### Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `429` | `{ "error": "Too many requests, please try again later" }` | 触发速率限制 |
| `500` | `{ "error": "Internal server error" }` | 服务器内部错误 |

---

## 4. Hono 路由挂载

在 `packages/server/src/index.ts` 中：

```typescript
import { Hono } from 'hono'
import { auth } from './auth.js'

const app = new Hono()

// Better Auth handler 挂载
app.on(['POST', 'GET'], '/api/auth/**', (c) => {
  return auth.handler(c.req.raw)
})

// 其他业务路由...
```

> `auth.handler` 为 Better Auth 提供的标准 Hono/Request 处理器，内部根据路径和方法分发到对应端点。

---

## 5. 认证中间件

### 5.1 导出

```typescript
// packages/server/src/middleware/auth.ts
import type { MiddlewareHandler } from 'hono'

export const requireAuth: MiddlewareHandler
```

### 5.2 行为

- 读取请求 Cookie
- 调用 `auth.api.getSession()` 验证 session
- 有效：将 `user` 和 `session` 注入 Hono Context
- 无效：返回 `401 Unauthorized`

### 5.3 使用方式

```typescript
import { requireAuth } from './middleware/auth.js'

app.use('/api/knowledge-bases/*', requireAuth)
app.use('/api/sessions/*', requireAuth)
app.use('/api/settings', requireAuth)
```

---

## 6. 数据模型（API 层面）

### 6.1 User

```typescript
interface User {
  id: string           // UUID
  email: string        // 唯一
  name: string | null
  avatar: string | null
  createdAt: string    // ISO 8601
}
```

### 6.2 Session

```typescript
interface Session {
  id: string           // UUID 或 Better Auth 生成的 token
  userId: string       // 关联用户 ID
  expiresAt: string    // ISO 8601
}
```

---

## 7. 错误码汇总

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| `200` | OK | 成功响应 |
| `400` | Bad Request | 请求体非法、字段缺失、格式错误、密码强度不足 |
| `401` | Unauthorized | 登录凭证错误、session 无效/过期（受保护路由） |
| `409` | Conflict | 邮箱已注册 |
| `429` | Too Many Requests | 触发速率限制 |
| `500` | Internal Server Error | 服务器内部异常 |

---

## 8. 速率限制头

当触发 `429` 时，响应包含：

```http
Retry-After: 60
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
```
