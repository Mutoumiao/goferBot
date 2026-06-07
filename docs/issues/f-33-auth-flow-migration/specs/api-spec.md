# API 规格：鉴权流程端到端迁移

> 状态：draft | 关联 issue：f-33

---

## 1. 概述

本 issue 的 API 层为前端调用层（alova method 定义），不涉及后端 API 变更。所有 API 端点使用现有 NestJS 后端接口。

---

## 2. 涉及的 API 端点

### 2.1 POST /api/auth/login

| 项目 | 内容 |
|------|------|
| 方法 | POST |
| 路径 | `/api/auth/login` |
| 请求体 | `{ email: string, password: string }` |
| 成功响应 200 | `{ data: { accessToken: string, user: { id, email, name } } }` |
| 错误响应 401 | `{ statusCode: 401, message: "邮箱或密码错误" }` |
| alova method | `api.Post<AuthResponse>('/auth/login', data)` |

### 2.2 POST /api/auth/register

| 项目 | 内容 |
|------|------|
| 方法 | POST |
| 路径 | `/api/auth/register` |
| 请求体 | `{ email: string, password: string, name?: string }` |
| 成功响应 201 | `{ data: { accessToken: string, user: { id, email, name } } }` |
| 错误响应 409 | `{ statusCode: 409, message: "邮箱已注册" }` |
| alova method | `api.Post<AuthResponse>('/auth/register', data)` |

### 2.3 POST /api/auth/refresh

| 项目 | 内容 |
|------|------|
| 方法 | POST |
| 路径 | `/api/auth/refresh` |
| 请求头 | `Authorization: Bearer <refreshToken>` 或 body 中传 refreshToken |
| 成功响应 200 | `{ data: { accessToken: string } }` |
| 错误响应 401 | Token 无效/过期 |
| 调用方式 | alova 实例内部 `responded.onError` 中直接 `fetch()` 调用，不经过 alova method（避免递归） |

### 2.4 GET /api/auth/me

| 项目 | 内容 |
|------|------|
| 方法 | GET |
| 路径 | `/api/auth/me` |
| 请求头 | `Authorization: Bearer <token>` |
| 成功响应 200 | `{ data: { id, email, name, ... } }` |
| 错误响应 401 | 未认证 |
| alova method | `api.Get<User>('/auth/me')` |

---

## 3. 数据流

```
前端表单 → alova method → fetch → /api/auth/* → NestJS → PostgreSQL
                                                              ↓
前端 Store ← alova onSuccess ← { data: T } ← ResponseInterceptor ← Prisma
```

---

## 4. 前端类型定义

所有类型通过 `z.infer` 从 `packages/data/src/schemas/auth.schema.ts` 导出：

```typescript
// packages/data/src/types/index.ts
import { z } from 'zod'
import { loginRequestSchema, registerRequestSchema, authResponseSchema } from '../schemas/auth.schema'

export type LoginRequest = z.infer<typeof loginRequestSchema>
export type RegisterRequest = z.infer<typeof registerRequestSchema>
export type AuthResponse = z.infer<typeof authResponseSchema>
```

前端通过 `import type { LoginRequest, AuthResponse } from '@goferbot/data'` 引用。
