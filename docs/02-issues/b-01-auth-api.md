状态: needs-triage
分类: enhancement

## 要构建的内容

集成 Better Auth，实现邮箱+密码注册/登录/登出/会话查询 API。

## 规格引用

- 功能规格: docs/03-specs/features/auth-system/feature-spec.md
- 行为规格: docs/03-specs/features/auth-system/behavior-spec.md
- API 规格: docs/03-specs/features/auth-system/api-spec.md

## 验收标准

- [ ] `packages/server/src/auth.ts` 配置 Better Auth，使用 Drizzle Adapter
- [ ] `POST /api/auth/sign-in/email` 支持邮箱+密码登录，返回 Session Cookie
- [ ] `POST /api/auth/sign-up/email` 支持邮箱+密码注册，自动创建用户记录
- [ ] `POST /api/auth/sign-out` 支持登出，清除 Session Cookie
- [ ] `GET /api/auth/session` 支持获取当前会话信息
- [ ] Hono 路由正确挂载 auth handler：`app.on(['POST', 'GET'], '/api/auth/**', ...)`
- [ ] 密码使用 bcrypt 哈希存储（Better Auth 默认）
- [ ] 错误响应格式统一：`{ error: string }`
- [ ] 提供 `packages/server/src/middleware/auth.ts` 认证中间件，供其他路由使用

## 阻塞于

- i-02-drizzle-orm-setup（需要 users 表和 Drizzle Adapter）

## 范围外

- OAuth 登录（后续扩展）
- 邮箱验证
- 密码重置
- 角色权限系统（RBAC）

## Agent 简报

**分类：** enhancement
**摘要：** 集成 Better Auth，实现邮箱+密码认证 API

**当前行为：**
项目无认证系统，所有接口公开访问。

**期望行为：**
用户可通过邮箱+密码注册和登录，Session Cookie 维持登录态，后续 API 可验证认证状态。

**关键接口：**
- `POST /api/auth/sign-in/email` — 登录
- `POST /api/auth/sign-up/email` — 注册
- `POST /api/auth/sign-out` — 登出
- `GET /api/auth/session` — 获取会话
- `packages/server/src/middleware/auth.ts` — 认证中间件

**验收标准：**
- [ ] Better Auth 配置正确，使用 Drizzle Adapter
- [ ] 登录 API 返回 Session Cookie
- [ ] 注册 API 自动创建用户记录
- [ ] 登出 API 清除 Session Cookie
- [ ] 会话查询 API 返回当前用户信息
- [ ] Hono 路由正确挂载 auth handler
- [ ] 密码使用 bcrypt 哈希
- [ ] 错误响应格式统一
- [ ] 提供认证中间件

**范围外：**
- OAuth 登录
- 邮箱验证
- 密码重置
- RBAC
