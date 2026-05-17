---
issue_id: b-01-auth-api
type: behavior-spec
status: draft
summary: 定义注册、登录、登出、会话查询4条认证流程，包含输入校验、bcrypt 哈希、Session Cookie 机制及路由守卫行为，覆盖冲突处理与安全边界（速率限制、密码强度）。
---
# Auth System — 行为规格

> 对应 issue: `b-01-auth-api`
> 关联: `q-01-security-baseline`

---

## 1. 认证流程

### 1.1 注册流程

```
[前端] POST /api/auth/sign-up/email
              body: { email, password, name? }
                  ↓
[后端] 校验输入格式（email 合法、password ≥ 8 位）
                  ↓
       查询 users 表：email 是否已存在？
           ├─ 是 → 返回 409 { error: "Email already registered" }
           └─ 否 → bcrypt 哈希密码 → 插入 users 记录
                  ↓
       创建 session → 插入 sessions 表
                  ↓
       返回 200 + body: { user, session }
              + Set-Cookie: goferbot.session=xxx; HttpOnly; SameSite=Lax
```

### 1.2 登录流程

```
[前端] POST /api/auth/sign-in/email
              body: { email, password }
                  ↓
[后端] 查询 users 表：email 是否存在？
           ├─ 否 → 返回 401 { error: "Invalid email or password" }
           └─ 是 → bcrypt compare 密码
                  ↓
              密码是否匹配？
           ├─ 否 → 返回 401 { error: "Invalid email or password" }
           └─ 是 → 创建新 session（轮换）
                  ↓
       返回 200 + body: { user, session }
              + Set-Cookie: goferbot.session=xxx; HttpOnly; SameSite=Lax
```

### 1.3 登出流程

```
[前端] POST /api/auth/sign-out
              Cookie: goferbot.session=xxx
                  ↓
[后端] 从 Cookie 读取 session token
                  ↓
       删除 sessions 表中对应记录
                  ↓
       返回 200 + Set-Cookie: goferbot.session=; Max-Age=0; Path=/
```

### 1.4 会话查询流程

```
[前端] GET /api/auth/session
              Cookie: goferbot.session=xxx
                  ↓
[后端] 从 Cookie 读取 session token
                  ↓
       查询 sessions 表：token 是否有效且未过期？
           ├─ 否 → 返回 200 { user: null, session: null }
           └─ 是 → 联查 users 表
                  ↓
       返回 200 { user, session }
```

---

## 2. Session Cookie 生命周期

### 2.1 Cookie 名称

`goferbot.session`

### 2.2 Cookie 属性

| 属性 | 值 | 说明 |
|------|-----|------|
| `HttpOnly` | `true` | 禁止 JavaScript 读取 |
| `Secure` | `process.env.NODE_ENV === 'production'` | 生产环境仅 HTTPS 传输 |
| `SameSite` | `'Lax'` | 允许同站导航携带，防范 CSRF |
| `Path` | `'/'` | 全站可用 |
| `Max-Age` | 由 Better Auth 配置（默认 7 天） | 会话有效期 |

### 2.3 Session 有效期

- **默认 TTL**：7 天（`session.expiresAt = now + 7d`）
- **滑动续期**：每次请求 `/api/auth/session` 或任意受保护路由时，若 session 剩余有效期 < 3 天，自动续期至 7 天（Better Auth 默认行为，若不支持则手动实现）
- **强制过期**：登出时立即删除数据库 session 记录并清除 Cookie

### 2.4 多设备登录

- 允许同一用户在多台设备登录，每台设备拥有独立 session 记录
- 登出仅销毁当前设备的 session，不影响其他设备

---

## 3. 错误状态与响应

### 3.1 错误响应统一格式

所有认证相关错误均返回 JSON：

```json
{
  "error": "人类可读的错误描述"
}
```

### 3.2 状态码与错误场景

| 状态码 | 场景 | 错误消息示例 |
|--------|------|--------------|
| `400` | 请求体格式非法、字段缺失 | `"Invalid request body"` |
| `400` | 密码强度不足（< 8 位） | `"Password must be at least 8 characters"` |
| `401` | 登录凭证错误 | `"Invalid email or password"` |
| `401` | session 过期或无效（受保护路由） | `"Unauthorized"` |
| `409` | 邮箱已注册 | `"Email already registered"` |
| `429` | 速率限制触发 | `"Too many requests, please try again later"` |
| `500` | 服务器内部错误 | `"Internal server error"` |

### 3.3 安全错误处理原则

- **不暴露用户是否存在**：登录时无论邮箱是否存在，均返回相同的 401 错误消息 `"Invalid email or password"`
- **不暴露内部信息**：错误响应中不得包含堆栈跟踪、SQL 语句、数据库字段名
- **不区分错误类型**：注册时若邮箱已存在，返回 409（业务明确场景可区分）；登录时不区分是邮箱不存在还是密码错误

---

## 4. 认证中间件行为

### 4.1 中间件位置

`packages/server/src/middleware/auth.ts`

### 4.2 行为定义

```
[请求进入受保护路由]
        ↓
auth.middleware() 执行
        ↓
读取请求 Cookie: goferbot.session
        ↓
调用 getSession(request)
        ↓
session 有效？
    ├─ 是 → 将 user / session 注入 Hono context（c.set('user', user); c.set('session', session)）
    │       → 执行后续 handler
    └─ 否 → 返回 401 { error: "Unauthorized" }
```

### 4.3 Context 注入规范

中间件验证通过后，在 Hono Context 中设置以下变量：

| Key | 类型 | 说明 |
|-----|------|------|
| `user` | `User` | 当前登录用户对象 |
| `session` | `Session` | 当前会话对象 |

后续 handler 通过 `c.get('user')` / `c.get('session')` 读取。

### 4.4 使用示例

```typescript
import { auth } from '../auth.js'
import { requireAuth } from '../middleware/auth.js'

const app = new Hono()

// 公开路由
app.get('/health', (c) => c.json({ ok: true }))

// 受保护路由
app.use('/api/knowledge-bases/*', requireAuth)
app.get('/api/knowledge-bases', (c) => {
  const user = c.get('user')
  // ... 查询该用户的知识库
})
```

---

## 5. 速率限制行为（对齐 q-01-security-baseline）

### 5.1 认证端点独立限速

| 端点 | 限制 | 窗口 |
|------|------|------|
| `POST /api/auth/sign-in/email` | 5 次 | 1 分钟 / IP |
| `POST /api/auth/sign-up/email` | 5 次 | 1 分钟 / IP |
| `POST /api/auth/sign-out` | 20 次 | 1 分钟 / IP |
| `GET /api/auth/session` | 60 次 | 1 分钟 / IP |

### 5.2 限速触发行为

- 超过限制时返回 `429 Too Many Requests`
- 响应头包含 `Retry-After: <秒数>`
- 响应体：`{ error: "Too many requests, please try again later" }`

---

## 6. 边界情况

| 场景 | 预期行为 |
|------|----------|
| 重复注册同一邮箱 | 409 `"Email already registered"` |
| 登录时邮箱不存在 | 401 `"Invalid email or password"`（与密码错误一致） |
| 使用过期 Cookie 访问 | 401 `"Unauthorized"`（受保护路由）或 200 `{ user: null }`（/session） |
| Cookie 被篡改 | 视为无效 session，行为同上 |
| 未携带 Cookie 访问受保护路由 | 401 `"Unauthorized"` |
| 注册后立即调用 /session | 返回刚创建的 session（Cookie 已设置） |
| 登出后再次使用旧 Cookie | 视为无效，行为同过期 Cookie |
