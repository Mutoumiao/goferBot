# 功能规格：鉴权流程端到端迁移

> 状态：draft | 关联 issue：f-33 | PRD：docs/prd/v3-frontend-migration.md §5.2 + §6.1 + §6.6

---

## 1. 目标

建立 apps/web 的完整鉴权基础设施：alova 实例（含 Token 刷新）、packages/data/ 共享包（auth 域 Zod schema）、Zustand auth Store、login/register 页面、TanStack Router 路由守卫。完成后可独立验证完整的登录→鉴权→Token 刷新闭环。

---

## 2. 功能描述

### 2.1 alova 实例（utils/server.ts）

创建 `apps/web/app/utils/server.ts`，导出 `alovaInstance`：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `statesHook` | `ReactHook` | alova/react 适配器 |
| `requestAdapter` | `createFetchAdapter()` | 浏览器 fetch |
| `baseURL` | `/api` | 配合 Vite proxy |
| `timeout` | 30000 | 30 秒超时 |
| `beforeRequest` | 注入 `Authorization: Bearer <token>` | 从 localStorage 读取 Token |
| `responded.onSuccess` | 返回 `json`（保持 `{ data: T }` 包装） | 对齐后端 `ResponseInterceptor` |
| `responded.onError` | Token 刷新队列逻辑 | 见 §2.2 |
| `shareRequest` | `true` | 请求共享/去重 |
| `cacheFor.GET` | `300_000`（5 分钟） | 默认缓存 GET 请求 |

### 2.2 Token 刷新机制

在 `responded.onError` 中实现（PRD §6.1 设计）：

```
请求 → 401 → 检查 isRefreshing
              ├─ false → 调 POST /api/auth/refresh
              │            ├─ 成功 → isRefreshing=false → refreshSubscribers.forEach(replay) → 重放当前请求
              │            └─ 失败 → isRefreshing=false → 清空 subscribers → 清除 Token → window.location='/login'
              └─ true  → return new Promise(resolve => refreshSubscribers.push(resolve))
```

**关键变量**（闭包内）：
- `isRefreshing: boolean` — 防止并发刷新
- `refreshSubscribers: Array<(token: string) => void>` — 等待刷新完成的请求队列

### 2.3 packages/data/ 共享包

创建 `packages/data/`：

```
packages/data/
├── src/
│   ├── schemas/
│   │   └── auth.schema.ts    # loginRequestSchema, registerRequestSchema, authResponseSchema
│   └── types/
│       └── index.ts          # z.infer 导出 TS 类型
├── package.json              # name: @goferbot/data
└── tsconfig.json
```

**Zod Schema 定义**（`auth.schema.ts`）：

```typescript
import { z } from 'zod'

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
})

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().nullable(),
  }),
})
```

### 2.4 API 方法（api/auth.ts）

```typescript
// apps/web/app/api/auth.ts
import type { LoginRequest, RegisterRequest, AuthResponse, User } from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

export const login = (data: LoginRequest) =>
  alovaInstance.Post<AuthResponse>('/auth/login', data)

export const register = (data: RegisterRequest) =>
  alovaInstance.Post<AuthResponse>('/auth/register', data)

export const getMe = () =>
  alovaInstance.Get<User>('/auth/me')
```

### 2.5 Zustand auth Store

```typescript
// apps/web/app/stores/auth.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}
```

使用 `persist` 中间件将 `token` 持久化到 `localStorage`。

### 2.6 页面

**`/login` 页面** (`app/routes/login.tsx`)：
- 登录表单（email + password）
- `useRequest(() => login(data), { immediate: false })`
- `send()` 手动触发登录
- loading 态：按钮禁用 + spinner
- error 态：错误提示 + 重试
- 成功后：`setAuth(user, token)` → `router.navigate('/app')`

**`/register` 页面** (`app/routes/register.tsx`)：
- 注册表单（email + password + name 可选）
- 成功后自动登录跳转

### 2.7 路由守卫

`/app` 布局路由 (`app/routes/app/route.tsx`) 的 `beforeLoad`：

```typescript
beforeLoad: async ({ context }) => {
  const token = localStorage.getItem('goferbot_access_token')
  if (!token) {
    throw redirect({ to: '/login' })
  }
}
```

---

## 3. 交互状态

| 状态 | 条件 | 渲染 |
|------|------|------|
| idle | 页面初始 | 空表单 |
| loading | 登录请求中 | 按钮 disabled + spinner，输入框 disabled |
| error | 请求失败（401/网络错误） | 错误消息 + 重试按钮 |
| success | 登录成功 | 自动跳转 `/app` |
| expired | Token 过期 | 自动刷新 → 成功则继续；失败则跳 `/login` |

---

## 4. 验收标准映射

| AC | 验收项 | 验证方式 |
|----|--------|----------|
| AC-01 | alova 实例创建完成，beforeRequest 注入 Token | 检查 `utils/server.ts` 存在 + 配置完整 |
| AC-02 | Token 刷新队列机制完整 | 单元测试 mock 401→refresh→重放 |
| AC-03 | packages/data/ auth schema + TS 类型 | 检查文件存在 + `pnpm type-check` |
| AC-04 | api/auth.ts 方法类型正确 | `pnpm type-check` |
| AC-05 | auth Store 管理登录状态/持久化 | Zustand devtools 验证 |
| AC-06 | /login 页面三态完整 | 手动测试 + 单元测试 |
| AC-07 | /register 页面可用 | 手动测试 |
| AC-08 | 路由守卫拦截未认证用户 | 未登录访问 `/app` → 302 `/login` |
| AC-09 | 刷新页面鉴权状态不丢失 | F5 后仍显示已登录 |

---

## 5. 参考资源

- [alova React 参考手册](../../../reference/alova-react-guide.md) — §4 实例配置 + §5 hooks + §8 GoferBot 集成
- [TanStack Start 参考手册](../../../reference/tanstack-start-guide.md) — §3.4 路由守卫
- [PRD v3 前端迁移](../../prd/v3-frontend-migration.md) — §6.1 鉴权方案 + §6.6 类型共享
