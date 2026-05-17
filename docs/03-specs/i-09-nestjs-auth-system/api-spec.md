---
issue_id: i-09-nestjs-auth-system
type: api-spec
status: approved
summary: 5个认证端点：注册 POST /auth/register、登录 POST /auth/login、刷新 POST /auth/refresh、登出 POST /auth/logout、当前用户 GET /auth/me，Bearer Token 认证，统一 { data } 包装。
---
# NestJS Auth System — API 规格

> 对应 issue: `i-09-nestjs-auth-system`
> 关联: `i-10-nestjs-security`, `i-14-jwt-api-client`

---

## 1. 基础信息

- **Base URL**: `http://localhost:3000`（Sidecar 开发端口）
- **Content-Type**: `application/json`
- **认证方式**: Bearer Token（`Authorization: Bearer <accessToken>`）
- **响应格式**: 统一包装 `{ data: T }`（由 `ResponseInterceptor` 处理）
- **错误格式**: `{ error: { code, message } }`（由 `AllExceptionsFilter` 处理）

---

## 2. 端点清单

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/api/auth/register` | 邮箱注册 | 否 |
| `POST` | `/api/auth/login` | 邮箱登录 | 否 |
| `POST` | `/api/auth/refresh` | 刷新 Access Token | 否 |
| `POST` | `/api/auth/logout` | 登出 | 是（Bearer） |
| `GET` | `/api/auth/me` | 获取当前用户信息 | 是（Bearer） |

---

## 3. 端点详情

### 3.1 POST /api/auth/register

用户注册。

#### Request

```http
POST /api/auth/register HTTP/1.1
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

#### Success Response — 201 Created

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "Alice",
      "avatar": null,
      "createdAt": "2026-05-16T08:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
  }
}
```

#### Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }` | 字段缺失或格式非法 |
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "Password must be at least 8 characters" } }` | 密码强度不足 |
| `409` | `{ "error": { "code": "CONFLICT", "message": "Email already registered" } }` | 邮箱已存在 |
| `429` | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }` | 触发速率限制 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.2 POST /api/auth/login

用户登录。

#### Request

```http
POST /api/auth/login HTTP/1.1
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

{
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "Alice",
      "avatar": null,
      "createdAt": "2026-05-16T08:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
  }
}
```

> 每次登录创建新的 Refresh Token，支持多设备登录。

#### Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }` | 字段缺失或格式非法 |
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "Invalid email or password" } }` | 邮箱不存在或密码错误（不区分） |
| `429` | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }` | 触发速率限制 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.3 POST /api/auth/refresh

使用 Refresh Token 获取新的 Access Token 和 Refresh Token（Token 轮换）。

#### Request

```http
POST /api/auth/refresh HTTP/1.1
Content-Type: application/json

{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `refreshToken` | string | 是 | 非空 |

#### Success Response — 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "bmV3IHJlZnJlc2ggdG9rZW4..."
  }
}
```

> 旧 Refresh Token 立即失效，新 Refresh Token 存入数据库。

#### Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }` | 字段缺失 |
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "Invalid or expired refresh token" } }` | Refresh Token 无效、过期或已被轮换 |
| `429` | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }` | 触发速率限制 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.4 POST /api/auth/logout

用户登出，使当前 Refresh Token 失效。

#### Request

```http
POST /api/auth/logout HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `refreshToken` | string | 是 | 非空 |

#### Success Response — 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "success": true
  }
}
```

> 即使 Refresh Token 已失效，也返回 200（幂等）。Access Token 在客户端自行清除。

#### Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }` | 字段缺失 |
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "Unauthorized" } }` | Access Token 无效或过期 |
| `429` | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }` | 触发速率限制 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.5 GET /api/auth/me

查询当前登录用户信息。

#### Request

```http
GET /api/auth/me HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response — 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Alice",
    "avatar": null,
    "createdAt": "2026-05-16T08:00:00.000Z"
  }
}
```

#### Error Responses

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "Unauthorized" } }` | Access Token 无效或过期 |
| `429` | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试" } }` | 触发速率限制 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

## 4. NestJS 守卫与装饰器

### 4.1 JwtAuthGuard

```typescript
// src/modules/auth/guards/jwt.guard.ts
import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### 4.2 使用方式

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'

@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  @Get()
  findAll(@CurrentUser() user: UserPayload) {
    // user = { sub: 'user-id', email: 'user@example.com' }
    return this.service.findAll(user.sub)
  }
}
```

### 4.3 @CurrentUser() 装饰器

```typescript
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const CurrentUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user as UserPayload
    return data ? user?.[data] : user
  },
)
```

---

## 5. 数据模型（API 层面）

### 5.1 User（响应体）

```typescript
interface User {
  id: string           // UUID
  email: string        // 唯一
  name: string | null
  avatar: string | null
  createdAt: string    // ISO 8601
}
```

### 5.2 AuthResponse（登录/注册）

```typescript
interface AuthResponse {
  user: User
  accessToken: string   // JWT，默认 15 分钟有效期
  refreshToken: string  // 随机字符串，默认 7 天有效期
}
```

### 5.3 RefreshResponse

```typescript
interface RefreshResponse {
  accessToken: string
  refreshToken: string
}
```

### 5.4 UserPayload（JWT Payload）

```typescript
interface UserPayload {
  sub: string    // 用户 ID
  email: string  // 用户邮箱
  iat: number    // 签发时间
  exp: number    // 过期时间
}
```

---

## 6. 错误码汇总

| 状态码 | Code | 含义 | 使用场景 |
|--------|------|------|----------|
| `200` | — | OK | 成功响应 |
| `201` | — | Created | 注册成功 |
| `400` | `VALIDATION_ERROR` | 参数校验失败 | Zod 校验失败、字段缺失、格式错误、密码强度不足 |
| `401` | `AUTH_ERROR` | 认证失败 | 登录凭证错误、Token 无效/过期、Refresh Token 无效 |
| `409` | `CONFLICT` | 冲突 | 邮箱已注册 |
| `429` | `RATE_LIMIT_EXCEEDED` | 速率限制 | 请求过于频繁 |
| `500` | `INTERNAL_ERROR` | 服务器内部错误 | 未捕获异常、数据库连接失败 |

---

## 7. 速率限制头

当触发 `429` 时，响应包含：

```http
Retry-After: 60
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
```

---

## 8. curl 测试示例

### 8.1 注册

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"securePass123","name":"Alice"}' \
  -v
```

### 8.2 登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"securePass123"}' \
  -v
```

### 8.3 获取当前用户

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <accessToken>" \
  -v
```

### 8.4 刷新 Token

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}' \
  -v
```

### 8.5 登出

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"refreshToken":"<refreshToken>"}' \
  -v
```

### 8.6 速率限制测试

连续执行 6 次登录请求：

```bash
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "\nHTTP %{http_code}\n"
done
```

预期：第 6 次返回 HTTP 429，响应体包含 `RATE_LIMIT_EXCEEDED`。
