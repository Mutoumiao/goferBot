# Feature Spec: JWT API Client（前端 JWT 认证客户端升级）

> Issue: `i-14-jwt-api-client`
> 状态: draft
> 日期: 2026-05-16
> 依赖: `i-09-nestjs-auth-system`
> 关联: `i-07-api-client`, `f-01-login-page`, `f-02-route-guards`

---

## 1. 目标

将前端 API 客户端从 Session Cookie（Better Auth）迁移到 JWT Token 认证，实现：
- 所有 API 请求自动携带 `Authorization: Bearer <accessToken>`
- Access Token 过期时自动使用 Refresh Token 刷新
- 刷新失败时自动重定向到登录页
- 提供统一的 Pinia Auth Store 管理认证状态

---

## 2. 用户故事

- 作为用户，我登录后发起的所有 API 请求都应自动携带认证信息，无需手动操作
- 作为用户，当我的 Token 过期时，应用应在后台静默刷新，不影响当前操作
- 作为用户，当刷新 Token 也失效时，应用应将我重定向到登录页并清除过期凭证
- 作为开发者，我可以通过 `useAuthStore` 获取当前认证状态，并调用登录/注册/登出方法

---

## 3. 范围

### 3.1 范围内（MVP）

- 升级 `api/client.ts`：移除 `credentials: 'include'`，改为自动注入 `Authorization` header
- 新建 `stores/auth.ts`：Pinia Store 管理 `accessToken` / `refreshToken`
- 更新 `api/types.ts`：JWT 相关类型 + `ApiResponse<T>` 适配 NestJS `{ data: T }` 格式
- 更新现有 stores（`session`, `knowledgeBase`, `settings`）：移除对旧 Session Cookie 的依赖，适配新响应格式
- API 客户端 401 拦截器：自动触发 Token 刷新流程
- Token 刷新队列：并发 401 请求排队，仅执行一次刷新

### 3.2 范围外（由其他 issue 负责）

- 登录/注册页面 UI（`f-01-login-page`）
- 路由守卫与未登录跳转（`f-02-route-guards`）
- 后端 JWT 认证系统实现（`i-09-nestjs-auth-system`）
- Token 持久化存储策略（当前使用 `localStorage`，后续可升级为加密存储）

---

## 4. 涉及模块

| 模块 | 文件 | 变更类型 |
|------|------|----------|
| API 客户端 | `packages/webui/src/api/client.ts` | 修改：移除 Cookie，注入 Authorization header，401 自动刷新 |
| 错误处理 | `packages/webui/src/api/errors.ts` | 保留（无需修改） |
| 类型定义 | `packages/webui/src/api/types.ts` | 修改：新增 JWT 类型，ApiResponse 适配 `{ data: T }` |
| Auth Store | `packages/webui/src/stores/auth.ts` | 新建：Pinia Store |
| Session Store | `packages/webui/src/stores/session.ts` | 修改：适配新响应格式 |
| KnowledgeBase Store | `packages/webui/src/stores/knowledgeBase.ts` | 修改：适配新响应格式，文件上传移除 `credentials: 'include'` |
| Settings Store | `packages/webui/src/stores/settings.ts` | 修改：适配新响应格式 |
| 测试 | `packages/webui/src/api/__tests__/client.spec.ts` | 修改：更新测试用例 |

---

## 5. 已做决策

### 5.1 Token 存储位置
- Access Token 和 Refresh Token 均存储在 `localStorage`
- Key: `goferbot_access_token`, `goferbot_refresh_token`
- 理由：Tauri 桌面应用无 HTTP Only Cookie 安全优势，localStorage 足够；后续可升级为 Tauri 安全存储

### 5.2 刷新策略
- 收到 401 时尝试刷新一次，使用 Refresh Token 调用 `POST /api/auth/refresh`
- 刷新成功：更新双 Token，重试原请求
- 刷新失败：清除 Token，触发 `onUnauthorized` 重定向登录页
- 并发刷新保护：多个请求同时 401 时，排队等待一次刷新结果

### 5.3 响应格式适配
- NestJS 后端统一返回 `{ data: T }` 格式
- API 客户端自动解包 `res.json().data`，store 直接拿到 `T`
- 错误格式：`{ error: { code, message } }`

### 5.4 认证 Header 注入方式
- 通过 API 客户端的请求拦截器注入 `Authorization: Bearer <token>`
- 不修改每个 store 的调用代码，集中管理

---

## 6. 验收标准

- [ ] `api.client.ts` 请求自动携带 `Authorization: Bearer <token>`
- [ ] `api.client.ts` 收到 401 时自动调用 `/api/auth/refresh` 刷新 Token
- [ ] 刷新失败时清除 Token 并触发 `onUnauthorized` 钩子（由路由守卫处理跳转）
- [ ] `stores/auth.ts` 提供 `accessToken` / `refreshToken` 状态
- [ ] `stores/auth.ts` 提供 `login(credentials)` / `register(credentials)` / `refresh()` / `logout()` / `isAuthenticated`
- [ ] `api/types.ts` 定义 `ApiResponse<T>`、`JwtTokens`、`JwtPayload` 等类型
- [ ] 所有现有 stores 更新为使用新的 auth store，不再依赖 Session Cookie
- [ ] `pnpm type-check` 通过
- [ ] `pnpm test` 通过

---

## 7. 关键接口

| 接口 | 说明 |
|------|------|
| `api.get<T>(path)` | 自动携带 Authorization header，返回 `T`（已解包 data） |
| `api.post<T>(path, body)` | 同上 |
| `api.patch<T>(path, body)` | 同上 |
| `api.delete(path)` | 同上 |
| `api.sse(path, body, callbacks)` | 自动携带 Authorization header |
| `useAuthStore().login(credentials)` | 登录并存储双 Token |
| `useAuthStore().register(credentials)` | 注册并存储双 Token |
| `useAuthStore().logout()` | 清除 Token 并调用后端登出 |
| `useAuthStore().isAuthenticated` | 计算属性，判断 accessToken 是否存在 |
