# b-01-auth-api 行为测试用例

> 对应 issue: `b-01-auth-api`
> 规格引用:
> - `docs/03-specs/features/auth-system/feature-spec.md`
> - `docs/03-specs/features/auth-system/api-spec.md`
> - `docs/03-specs/features/auth-system/behavior-spec.md`
> - `docs/04-plans/auth-api/2026-05-16.md`

---

## 1. 注册端点测试

### TC-B01-001: 使用合法邮箱和密码注册成功
- **前置条件**: 数据库已连接，users 表为空或不存在同名邮箱
- **步骤**:
  1. 发送 `POST /api/auth/sign-up/email`
  2. Body: `{ "email": "alice@example.com", "password": "securePass123", "name": "Alice" }`
- **预期结果**:
  - HTTP 200
  - 响应体包含 `user.id`（UUID）、`user.email` = `"alice@example.com"`、`user.name` = `"Alice"`、`user.avatar` = `null`
  - 响应体包含 `session.id`、`session.userId` 与 `user.id` 一致、`session.expiresAt` 为 ISO 8601 时间戳
  - 响应头包含 `Set-Cookie: goferbot.session=...; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
- **优先级**: P0

### TC-B01-002: 注册时邮箱已存在返回 409
- **前置条件**: 已存在用户 `alice@example.com`
- **步骤**:
  1. 再次发送 `POST /api/auth/sign-up/email`，Body 同 TC-B01-001
- **预期结果**:
  - HTTP 409
  - 响应体: `{ "error": "Email already registered" }`
  - 不返回 `Set-Cookie`
- **优先级**: P0

### TC-B01-003: 注册时密码不足 8 位返回 400
- **前置条件**: 无
- **步骤**:
  1. 发送 `POST /api/auth/sign-up/email`，Body: `{ "email": "bob@example.com", "password": "1234567" }`
- **预期结果**:
  - HTTP 400
  - 响应体: `{ "error": "Password must be at least 8 characters" }`
- **优先级**: P0

### TC-B01-004: 注册时缺少必填字段返回 400
- **前置条件**: 无
- **步骤**:
  1. 发送 `POST /api/auth/sign-up/email`，Body: `{ "email": "bob@example.com" }`（缺少 password）
- **预期结果**:
  - HTTP 400
  - 响应体: `{ "error": "Invalid request body" }`
- **优先级**: P0

### TC-B01-005: 注册时邮箱格式非法返回 400
- **前置条件**: 无
- **步骤**:
  1. 发送 `POST /api/auth/sign-up/email`，Body: `{ "email": "not-an-email", "password": "securePass123" }`
- **预期结果**:
  - HTTP 400
  - 响应体: `{ "error": "Invalid request body" }`
- **优先级**: P1

### TC-B01-006: 注册端点触发速率限制返回 429
- **前置条件**: 无
- **步骤**:
  1. 同一 IP 在 1 分钟内连续发送 6 次 `POST /api/auth/sign-up/email`（任意合法 Body）
- **预期结果**:
  - 第 6 次请求返回 HTTP 429
  - 响应体: `{ "error": "Too many requests, please try again later" }`
  - 响应头包含 `Retry-After: 60`、`X-RateLimit-Limit: 5`、`X-RateLimit-Remaining: 0`
- **优先级**: P1

---

## 2. 登录端点测试

### TC-B01-007: 使用正确凭证登录成功
- **前置条件**: 已注册用户 `alice@example.com`，密码 `securePass123`
- **步骤**:
  1. 发送 `POST /api/auth/sign-in/email`
  2. Body: `{ "email": "alice@example.com", "password": "securePass123" }`
- **预期结果**:
  - HTTP 200
  - 响应体包含 `user` 和 `session`，结构与 TC-B01-001 一致
  - 响应头包含新的 `Set-Cookie: goferbot.session=...`（session 轮换）
- **优先级**: P0

### TC-B01-008: 登录时密码错误返回 401
- **前置条件**: 已注册用户 `alice@example.com`
- **步骤**:
  1. 发送 `POST /api/auth/sign-in/email`，Body: `{ "email": "alice@example.com", "password": "wrongPassword" }`
- **预期结果**:
  - HTTP 401
  - 响应体: `{ "error": "Invalid email or password" }`
  - 不暴露邮箱是否存在
- **优先级**: P0

### TC-B01-009: 登录时邮箱不存在返回 401
- **前置条件**: 无
- **步骤**:
  1. 发送 `POST /api/auth/sign-in/email`，Body: `{ "email": "nobody@example.com", "password": "securePass123" }`
- **预期结果**:
  - HTTP 401
  - 响应体: `{ "error": "Invalid email or password" }`
  - 错误消息与密码错误时完全一致
- **优先级**: P0

### TC-B01-010: 登录时缺少必填字段返回 400
- **前置条件**: 无
- **步骤**:
  1. 发送 `POST /api/auth/sign-in/email`，Body: `{ "email": "alice@example.com" }`（缺少 password）
- **预期结果**:
  - HTTP 400
  - 响应体: `{ "error": "Invalid request body" }`
- **优先级**: P1

### TC-B01-011: 登录端点触发速率限制返回 429
- **前置条件**: 无
- **步骤**:
  1. 同一 IP 在 1 分钟内连续发送 6 次 `POST /api/auth/sign-in/email`（任意 Body）
- **预期结果**:
  - 第 6 次请求返回 HTTP 429
  - 响应体与响应头同 TC-B01-006
- **优先级**: P1

---

## 3. 会话查询端点测试

### TC-B01-012: 携带有效 Cookie 查询会话成功
- **前置条件**: 用户已登录并持有有效 `goferbot.session` Cookie
- **步骤**:
  1. 发送 `GET /api/auth/session`，Header: `Cookie: goferbot.session=<有效token>`
- **预期结果**:
  - HTTP 200
  - 响应体包含 `user` 和 `session`，结构与 TC-B01-001 一致
- **优先级**: P0

### TC-B01-013: 未携带 Cookie 查询会话返回空对象
- **前置条件**: 无
- **步骤**:
  1. 发送 `GET /api/auth/session`，不携带 Cookie
- **预期结果**:
  - HTTP 200
  - 响应体: `{ "user": null, "session": null }`
- **优先级**: P0

### TC-B01-014: 携带无效或过期 Cookie 查询会话返回空对象
- **前置条件**: Cookie 已过期或被篡改
- **步骤**:
  1. 发送 `GET /api/auth/session`，Header: `Cookie: goferbot.session=invalid-token`
- **预期结果**:
  - HTTP 200
  - 响应体: `{ "user": null, "session": null }`
- **优先级**: P0

### TC-B01-015: 会话查询端点触发速率限制返回 429
- **前置条件**: 无
- **步骤**:
  1. 同一 IP 在 1 分钟内连续发送 61 次 `GET /api/auth/session`
- **预期结果**:
  - 第 61 次请求返回 HTTP 429
  - 响应头 `X-RateLimit-Limit: 60`
- **优先级**: P2

---

## 4. 登出端点测试

### TC-B01-016: 携带有效 Cookie 登出成功并清除 Cookie
- **前置条件**: 用户已登录并持有有效 Cookie
- **步骤**:
  1. 发送 `POST /api/auth/sign-out`，Header: `Cookie: goferbot.session=<有效token>`
- **预期结果**:
  - HTTP 200
  - 响应体: `{ "success": true }`
  - 响应头包含 `Set-Cookie: goferbot.session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
- **优先级**: P0

### TC-B01-017: 登出后旧 Cookie 失效
- **前置条件**: 已完成 TC-B01-016
- **步骤**:
  1. 使用被清除的旧 Cookie 发送 `GET /api/auth/session`
- **预期结果**:
  - HTTP 200
  - 响应体: `{ "user": null, "session": null }`
- **优先级**: P0

### TC-B01-018: 未携带 Cookie 登出仍返回 200（幂等）
- **前置条件**: 无
- **步骤**:
  1. 发送 `POST /api/auth/sign-out`，不携带 Cookie
- **预期结果**:
  - HTTP 200
  - 响应体: `{ "success": true }`
  - 响应头仍包含清除 Cookie 的 `Set-Cookie`
- **优先级**: P1

### TC-B01-019: 登出端点触发速率限制返回 429
- **前置条件**: 无
- **步骤**:
  1. 同一 IP 在 1 分钟内连续发送 21 次 `POST /api/auth/sign-out`
- **预期结果**:
  - 第 21 次请求返回 HTTP 429
  - 响应头 `X-RateLimit-Limit: 20`
- **优先级**: P2

---

## 5. 认证中间件测试

### TC-B01-020: 受保护路由携带有效 Cookie 可正常访问
- **前置条件**: 已登录用户持有有效 Cookie；存在受保护路由（如 `/api/knowledge-bases`）挂载 `requireAuth`
- **步骤**:
  1. 携带有效 Cookie 访问受保护路由
- **预期结果**:
  - 不返回 401
  - 路由 handler 中可通过 `c.get('user')` 和 `c.get('session')` 获取当前用户和会话
- **优先级**: P0

### TC-B01-021: 受保护路由未携带 Cookie 返回 401
- **前置条件**: 受保护路由已挂载 `requireAuth`
- **步骤**:
  1. 不携带 Cookie 访问受保护路由
- **预期结果**:
  - HTTP 401
  - 响应体: `{ "error": "Unauthorized" }`
- **优先级**: P0

### TC-B01-022: 受保护路由携带无效 Cookie 返回 401
- **前置条件**: 受保护路由已挂载 `requireAuth`
- **步骤**:
  1. 携带 `Cookie: goferbot.session=invalid-token` 访问受保护路由
- **预期结果**:
  - HTTP 401
  - 响应体: `{ "error": "Unauthorized" }`
- **优先级**: P0

---

## 6. Cookie 与 Session 安全测试

### TC-B01-023: 登录响应 Cookie 包含正确属性
- **前置条件**: 无
- **步骤**:
  1. 完成 TC-B01-007 登录请求
- **预期结果**:
  - `Set-Cookie` 头包含 `HttpOnly`
  - 包含 `SameSite=Lax`
  - 包含 `Path=/`
  - 生产环境（`NODE_ENV=production`）下包含 `Secure`
- **优先级**: P0

### TC-B01-024: 密码在数据库中以 bcrypt 哈希存储
- **前置条件**: 已完成注册
- **步骤**:
  1. 直接查询数据库 `accounts` 表或 `users` 关联表中的 password 字段
- **预期结果**:
  - 存储值不是明文
  - 存储值以 `$2b$12$` 开头（bcrypt cost factor 12）
- **优先级**: P0

### TC-B01-025: 错误响应不暴露内部信息
- **前置条件**: 无
- **步骤**:
  1. 触发各类错误（400、401、409、429、500）
- **预期结果**:
  - 所有错误响应体仅包含 `{ "error": "人类可读描述" }`
  - 不包含堆栈跟踪、SQL 语句、数据库字段名
- **优先级**: P1

### TC-B01-026: 同一用户多设备登录拥有独立 Session
- **前置条件**: 已注册用户 `alice@example.com`
- **步骤**:
  1. 在设备 A 登录，记录 Cookie A
  2. 在设备 B 登录，记录 Cookie B
  3. 分别用 Cookie A 和 Cookie B 查询 `/api/auth/session`
- **预期结果**:
  - 两次查询均返回 200 及对应用户信息
  - 两个 session 的 `id` 不同
- **优先级**: P1

### TC-B01-027: 单设备登出不影响其他设备 Session
- **前置条件**: 已完成 TC-B01-026
- **步骤**:
  1. 在设备 A 执行登出
  2. 用 Cookie B 查询 `/api/auth/session`
- **预期结果**:
  - Cookie B 仍可正常返回会话信息
- **优先级**: P1

---

## 7. 路由挂载与基础设施测试

### TC-B01-028: Hono 正确挂载 Better Auth handler
- **前置条件**: 服务已启动
- **步骤**:
  1. 检查 `packages/server/src/index.ts`
  2. 确认存在 `app.on(['POST', 'GET'], '/api/auth/**', ...)`
- **预期结果**:
  - 所有 `/api/auth/*` 请求均进入 Better Auth handler
  - 不存在 404 路由未匹配
- **优先级**: P0

### TC-B01-029: 认证端点均应用独立速率限制中间件
- **前置条件**: 服务已启动
- **步骤**:
  1. 检查 `packages/server/src/index.ts`
  2. 确认 `/api/auth/sign-in/email`、`/api/auth/sign-up/email`、`/api/auth/sign-out`、`/api/auth/session` 分别挂载了对应限速中间件
- **预期结果**:
  - 每个端点均有独立限速配置
- **优先级**: P1

### TC-B01-030: 全局错误处理返回统一格式
- **前置条件**: 服务已启动
- **步骤**:
  1. 触发未捕获异常（如构造异常请求使服务器内部报错）
- **预期结果**:
  - HTTP 500
  - 响应体: `{ "error": "Internal server error" }`
- **优先级**: P1

---

## 8. 单元测试（BetterAuthProvider）

### TC-B01-031: BetterAuthProvider.signUp 创建新用户并返回 session
- **前置条件**: Vitest 测试环境就绪
- **步骤**:
  1. 调用 `provider.signUp({ email, password, name })`
- **预期结果**:
  - 返回 `AuthResult`，`user.email` 与输入一致
  - `session.userId` 与 `user.id` 一致
- **优先级**: P0

### TC-B01-032: BetterAuthProvider.signUp 重复邮箱抛出 ConflictError
- **前置条件**: 已存在该邮箱用户
- **步骤**:
  1. 再次调用 `provider.signUp({ email, password })`
- **预期结果**:
  - 抛出 `ConflictError`，消息为 `"Email already registered"`
- **优先级**: P0

### TC-B01-033: BetterAuthProvider.signUp 弱密码抛出 ValidationError
- **前置条件**: 无
- **步骤**:
  1. 调用 `provider.signUp({ email, password: "123" })`
- **预期结果**:
  - 抛出 `ValidationError`，消息为 `"Password must be at least 8 characters"`
- **优先级**: P0

### TC-B01-034: BetterAuthProvider.signIn 正确凭证返回用户和 session
- **前置条件**: 已注册用户
- **步骤**:
  1. 调用 `provider.signIn({ email, password })`
- **预期结果**:
  - 返回 `AuthResult`，`user.email` 与输入一致
- **优先级**: P0

### TC-B01-035: BetterAuthProvider.signIn 错误凭证抛出 AuthError
- **前置条件**: 已注册用户
- **步骤**:
  1. 调用 `provider.signIn({ email, password: "wrong" })`
- **预期结果**:
  - 抛出 `AuthError`，消息为 `"Invalid email or password"`
- **优先级**: P0

### TC-B01-036: BetterAuthProvider.getSession 有效请求返回 session
- **前置条件**: 已登录并构造携带 Cookie 的 Request 对象
- **步骤**:
  1. 调用 `provider.getSession(request)`
- **预期结果**:
  - 返回 `Session` 对象，`userId` 与登录用户一致
- **优先级**: P0

### TC-B01-037: BetterAuthProvider.getSession 无效 Cookie 返回 null
- **前置条件**: 无
- **步骤**:
  1. 构造携带无效 Cookie 的 Request 对象
  2. 调用 `provider.getSession(request)`
- **预期结果**:
  - 返回 `null`
- **优先级**: P0

### TC-B01-038: BetterAuthProvider.signOut 销毁 session 后 getSession 返回 null
- **前置条件**: 已登录并持有有效 Cookie
- **步骤**:
  1. 调用 `provider.signOut(request)`
  2. 再次调用 `provider.getSession(request)`
- **预期结果**:
  - 第二次调用返回 `null`
- **优先级**: P0

---

## 测试用例汇总

| TC-ID | 名称 | 优先级 | 类型 |
|-------|------|--------|------|
| TC-B01-001 | 使用合法邮箱和密码注册成功 | P0 | API |
| TC-B01-002 | 注册时邮箱已存在返回 409 | P0 | API |
| TC-B01-003 | 注册时密码不足 8 位返回 400 | P0 | API |
| TC-B01-004 | 注册时缺少必填字段返回 400 | P0 | API |
| TC-B01-005 | 注册时邮箱格式非法返回 400 | P1 | API |
| TC-B01-006 | 注册端点触发速率限制返回 429 | P1 | API |
| TC-B01-007 | 使用正确凭证登录成功 | P0 | API |
| TC-B01-008 | 登录时密码错误返回 401 | P0 | API |
| TC-B01-009 | 登录时邮箱不存在返回 401 | P0 | API |
| TC-B01-010 | 登录时缺少必填字段返回 400 | P1 | API |
| TC-B01-011 | 登录端点触发速率限制返回 429 | P1 | API |
| TC-B01-012 | 携带有效 Cookie 查询会话成功 | P0 | API |
| TC-B01-013 | 未携带 Cookie 查询会话返回空对象 | P0 | API |
| TC-B01-014 | 携带无效或过期 Cookie 查询会话返回空对象 | P0 | API |
| TC-B01-015 | 会话查询端点触发速率限制返回 429 | P2 | API |
| TC-B01-016 | 携带有效 Cookie 登出成功并清除 Cookie | P0 | API |
| TC-B01-017 | 登出后旧 Cookie 失效 | P0 | API |
| TC-B01-018 | 未携带 Cookie 登出仍返回 200（幂等） | P1 | API |
| TC-B01-019 | 登出端点触发速率限制返回 429 | P2 | API |
| TC-B01-020 | 受保护路由携带有效 Cookie 可正常访问 | P0 | API |
| TC-B01-021 | 受保护路由未携带 Cookie 返回 401 | P0 | API |
| TC-B01-022 | 受保护路由携带无效 Cookie 返回 401 | P0 | API |
| TC-B01-023 | 登录响应 Cookie 包含正确属性 | P0 | 安全 |
| TC-B01-024 | 密码在数据库中以 bcrypt 哈希存储 | P0 | 安全 |
| TC-B01-025 | 错误响应不暴露内部信息 | P1 | 安全 |
| TC-B01-026 | 同一用户多设备登录拥有独立 Session | P1 | 功能 |
| TC-B01-027 | 单设备登出不影响其他设备 Session | P1 | 功能 |
| TC-B01-028 | Hono 正确挂载 Better Auth handler | P0 | 基础设施 |
| TC-B01-029 | 认证端点均应用独立速率限制中间件 | P1 | 基础设施 |
| TC-B01-030 | 全局错误处理返回统一格式 | P1 | 基础设施 |
| TC-B01-031 | BetterAuthProvider.signUp 创建新用户并返回 session | P0 | 单元测试 |
| TC-B01-032 | BetterAuthProvider.signUp 重复邮箱抛出 ConflictError | P0 | 单元测试 |
| TC-B01-033 | BetterAuthProvider.signUp 弱密码抛出 ValidationError | P0 | 单元测试 |
| TC-B01-034 | BetterAuthProvider.signIn 正确凭证返回用户和 session | P0 | 单元测试 |
|-B01-035 | BetterAuthProvider.signIn 错误凭证抛出 AuthError | P0 | 单元测试 |
| TC-B01-036 | BetterAuthProvider.getSession 有效请求返回 session | P0 | 单元测试 |
| TC-B01-037 | BetterAuthProvider.getSession 无效 Cookie 返回 null | P0 | 单元测试 |
| TC-B01-038 | BetterAuthProvider.signOut 销毁 session 后 getSession 返回 null | P0 | 单元测试 |
