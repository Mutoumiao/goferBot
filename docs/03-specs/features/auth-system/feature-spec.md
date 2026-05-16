# Auth System — 功能规格

> 对应 issue: `b-01-auth-api`
> 依赖: `i-00-core-interfaces`, `i-02-drizzle-orm-setup`
> 对齐安全基线: `q-01-security-baseline`

---

## 1. 目标

为 GoferBot 提供基于邮箱+密码的认证能力，支持注册、登录、登出、会话查询，并为后续所有业务 API 提供统一的认证中间件。

---

## 2. 范围

### 2.1 范围内（MVP）

- 邮箱 + 密码注册与登录
- Session Cookie 维持登录态
- 登出与会话查询
- Hono 认证中间件（供其他路由使用）
- 与 `IAuthProvider` 接口对齐

### 2.2 范围外（后续扩展）

- OAuth 登录（GitHub / Google 等）
- 邮箱验证
- 密码重置
- 角色权限系统（RBAC）

---

## 3. 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 认证框架 | Better Auth | 支持多适配器、Session Cookie、bcrypt 哈希 |
| 数据库适配 | Drizzle Adapter | 复用项目已有的 Drizzle ORM 与 PostgreSQL |
| 密码哈希 | bcrypt | Better Auth 默认，cost factor 12 |
| Session 存储 | PostgreSQL | Better Auth 通过 Drizzle Adapter 持久化 session 表 |
| Cookie 传输 | 标准 HTTP Cookie | `HttpOnly`, `Secure`（生产）, `SameSite=Lax` |

---

## 4. 架构设计

### 4.1 模块结构

```
packages/server/
├── src/
│   ├── auth.ts                    # Better Auth 实例配置（Drizzle Adapter）
│   ├── interfaces/
│   │   └── IAuthProvider.ts       # 核心接口（已完成）
│   ├── providers/
│   │   └── BetterAuthProvider.ts  # IAuthProvider 实现
│   ├── middleware/
│   │   └── auth.ts                # Hono 认证中间件（导出实例方法）
│   └── index.ts                   # Hono app 挂载 auth handler
```

### 4.2 数据流

```
前端请求
    ↓
Hono app.on(['POST','GET'], '/api/auth/**', handler)
    ↓
Better Auth 内部路由分发
    ↓
Drizzle Adapter 读写 users / sessions / accounts / verifications 表
    ↓
返回 JSON + Set-Cookie（登录/注册）或清除 Cookie（登出）
```

### 4.3 数据库表（由 Better Auth + Drizzle Adapter 自动管理）

Better Auth 通过 Drizzle Adapter 需要以下表（与项目 `users` 表对齐）：

- `users` — 用户主表（项目已定义，需兼容 Better Auth 字段）
- `sessions` — 会话表
- `accounts` — 账号关联表（MVP 仅邮箱密码，但表需存在）
- `verifications` — 验证令牌表（预留）

> 项目 `users` 表字段（`id`, `email`, `name`, `avatar`, `createdAt`）需与 Better Auth 默认 schema 兼容。若 Better Auth 要求额外字段（如 `emailVerified`），在 Drizzle schema 中补充并允许 nullable。

---

## 5. 接口对齐

`BetterAuthProvider` 必须实现 `IAuthProvider`：

| 接口方法 | Better Auth 对应能力 | 说明 |
|----------|----------------------|------|
| `signUp(credentials)` | `auth.api.signUpEmail({ body: {...} })` | 注册后返回用户 + session |
| `signIn(credentials)` | `auth.api.signInEmail({ body: {...} })` | 登录后返回用户 + session |
| `signOut(request)` | `auth.api.signOut({ headers: request.headers })` | 读取 Cookie 销毁 session |
| `getSession(request)` | `auth.api.getSession({ headers: request.headers })` | 返回 session 或 null |
| `middleware()` | 内部调用 `getSession`，未登录返回 401 | Hono `MiddlewareHandler` |

---

## 6. 安全要求（对齐 q-01-security-baseline）

1. **速率限制**：认证端点（`/api/auth/sign-in/email`, `/api/auth/sign-up/email`）独立限速 **5 次/分钟/IP**，防止暴力破解。
2. **CORS**：若保留 CORS，`Access-Control-Allow-Credentials: true` 必须配合明确的 `Allow-Origin`（非 `*`）。
3. **错误响应**：任何认证错误统一返回 `{ error: string }`，不暴露内部堆栈、数据库细节或用户是否存在。
4. **密码策略**：最小长度 8 位，Better Auth 默认校验；bcrypt cost factor 12。
5. **Cookie 属性**：
   - `HttpOnly: true`
   - `Secure: process.env.NODE_ENV === 'production'`
   - `SameSite: 'Lax'`
   - `Path: '/'`

---

## 7. 验收标准

- [ ] `packages/server/src/auth.ts` 配置 Better Auth，使用 Drizzle Adapter
- [ ] `POST /api/auth/sign-in/email` 支持邮箱+密码登录，返回 Session Cookie
- [ ] `POST /api/auth/sign-up/email` 支持邮箱+密码注册，自动创建用户记录
- [ ] `POST /api/auth/sign-out` 支持登出，清除 Session Cookie
- [ ] `GET /api/auth/session` 支持获取当前会话信息
- [ ] Hono 路由正确挂载 auth handler：`app.on(['POST', 'GET'], '/api/auth/**', ...)`
- [ ] 密码使用 bcrypt 哈希存储（Better Auth 默认）
- [ ] 错误响应格式统一：`{ error: string }`
- [ ] 提供 `packages/server/src/middleware/auth.ts` 认证中间件，供其他路由使用
- [ ] 认证端点有独立的速率限制（5 req/min/IP）
