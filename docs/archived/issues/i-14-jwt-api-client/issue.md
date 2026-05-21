---
id: i-14-jwt-api-client
type: issue
status: closed
track: infra
priority: p0
summary: 升级前端 API 客户端，从 Session Cookie 改为 JWT Token 认证。API 客户端使用 JWT Token，支持自动刷新，Auth Store 管理 token。
blocked_by: [i-09-nestjs-auth-system]
blocks: []
spec: docs/03-specs/i-14-jwt-api-client/
plan: docs/04-plans/i-14-jwt-api-client/v1.md
tests: docs/08-test-cases/i-14-jwt-api-client/
token_estimate: 900
---

状态: completed
分类: enhancement

## 要构建的内容

升级前端 API 客户端，从 Session Cookie 改为 JWT Token 认证。

## 背景

架构决策从 Session Cookie（Better Auth）迁移到 JWT Token（ADR-0004 更新）。前端 API 客户端需要相应调整。

## 验收标准

- [ ] `packages/webui/src/api/client.ts` — 更新 API 客户端
  - 请求头自动携带 `Authorization: Bearer <token>`
  - 支持 Token 刷新（401 时自动刷新）
  - 刷新失败时重定向到登录页
- [ ] `packages/webui/src/stores/auth.ts` — 新建 Auth Store（Pinia）
  - `accessToken` / `refreshToken` 状态
  - `login(credentials)` — 登录，存储 token
  - `register(credentials)` — 注册
  - `refresh()` — 刷新 token
  - `logout()` — 清除 token
  - `isAuthenticated` — 计算属性
- [ ] `packages/webui/src/api/types.ts` — 更新类型定义
  - `ApiResponse<T>` 支持 `{ data: T }` 格式
  - JWT 相关类型
- [ ] 更新所有 stores（session/knowledgeBase/settings）使用新的 auth store
- [ ] `pnpm type-check` 通过
- [ ] `pnpm test` 通过

## 阻塞于

- i-09-nestjs-auth-system（需要 JWT 认证 API）

## 范围外

- 登录/注册页面 UI（由 f-01 负责）
- 路由守卫（由 f-02 负责）

## Agent 简报

**分类：** enhancement
**摘要：** 前端 API 客户端 JWT 化升级

**当前行为：**
API 客户端使用 Session Cookie（Better Auth）。

**期望行为：**
API 客户端使用 JWT Token，支持自动刷新。

**关键接口：**
- `api.client.ts` — 更新后的 API 客户端
- `stores/auth.ts` — 认证状态管理

**验收标准：**
- [ ] Authorization header 自动携带
- [ ] Token 自动刷新
- [ ] Auth Store 管理 token
- [ ] 所有 stores 更新
- [ ] type-check 通过
- [ ] test 通过

**范围外：**
- 登录/注册页面
- 路由守卫
