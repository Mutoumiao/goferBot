# 状态管理

> 本项目中状态的管理方式。

---

## 概述

Admin 前端使用 **Zustand** 作为全局状态管理方案，配合 **alova** 处理服务端状态。状态分为三层：全局状态（Zustand）、服务端状态（alova）、本地状态（React useState）。

---

## 状态类别

### 分层架构

```
┌─────────────────────────────────────────────┐
│              全局状态层 (Zustand)            │
│  - auth.ts      (用户认证信息)               │
│  - settings.ts  (外观设置等)                 │
├─────────────────────────────────────────────┤
│             服务端状态层 (alova)             │
│  - API 数据获取与缓存                        │
│  - 自动 Token 刷新                          │
│  - 请求共享与去重                           │
├─────────────────────────────────────────────┤
│             本地状态层 (useState)            │
│  - 组件内部状态                              │
│  - 表单状态                                  │
│  - UI 交互状态                               │
└─────────────────────────────────────────────┘
```

### 状态选择决策树

```
需要跨组件/路由共享？
    ├── 是 → 使用 Zustand 全局状态
    └── 否 → 需要服务端数据？
              ├── 是 → 使用 alova + useQueryWithRetry
              └── 否 → 使用 useState / useReducer
```

---

## 全局状态 (Zustand)

### Auth Store

```tsx
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AdminRole = 'ADMIN' | 'USER' | 'SUPER_ADMIN'

export interface AdminUser {
  id: string
  email: string
  name?: string
  role: AdminRole
  avatarUrl?: string | null
  isActive: boolean
  mustChangePassword?: boolean
  permissions?: string[]
}

interface AuthState {
  user: AdminUser | null
  isAuthenticated: boolean
  isInitialized: boolean
  _hydrated: boolean

  setUser: (user: AdminUser) => void
  clearAuth: () => void
  setInitialized: (value: boolean) => void
  setMustChangePassword: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      _hydrated: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: true,
          isInitialized: true,
        }),

      clearAuth: () => {
        localStorage.removeItem('goferbot-admin-auth')
        set({
          user: null,
          isAuthenticated: false,
          isInitialized: false,
        })
      },

      setInitialized: (value) => set({ isInitialized: value }),

      setMustChangePassword: (value) =>
        set((state) => ({
          user: state.user ? { ...state.user, mustChangePassword: value } : null,
        })),
    }),
    {
      name: 'goferbot-admin-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return
          state._hydrated = true
          if (state.isAuthenticated && state.user) {
            useAuthStore.setState({ isInitialized: true })
          }
        }
      },
    },
  ),
)
```

### Settings Store

```tsx
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AppearanceMode = 'light' | 'dark' | 'system'

interface SettingsState {
  appearance: AppearanceMode
  setAppearance: (v: AppearanceMode) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appearance: 'light',
      setAppearance: (v) => set({ appearance: v }),
    }),
    {
      name: 'goferbot-admin-settings',
      partialize: (state) => ({
        appearance: state.appearance,
      }),
    },
  ),
)
```

### 使用模式

```tsx
import { useAuthStore } from '@/stores/auth'

export function UserAvatar() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return (
    <div>
      <Avatar>{user?.name?.[0] ?? 'A'}</Avatar>
      <Button onClick={clearAuth}>退出登录</Button>
    </div>
  )
}
```

---

## 何时使用全局状态

### 推荐使用全局状态的场景

1. **用户认证信息**：user、isAuthenticated、permissions
2. **全局配置**：外观模式、主题设置
3. **跨页面状态**：需要在多个路由间共享的状态
4. **持久化状态**：需要页面刷新后保持的状态

### 不推荐使用全局状态的场景

1. **表单状态**：使用 React useState 或 Ant Design Form
2. **列表数据**：使用 alova + useQueryWithRetry
3. **组件临时状态**：使用 useState
4. **路由参数**：使用 TanStack Router 的 params

---

## 服务端状态

### alova 配置

Admin 前端使用 alova 处理服务端状态，配置了自动 Token 刷新和请求共享：

```tsx
export const alovaInstance = createAlova({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  shareRequest: true,
  requestAdapter: adapterFetch({
    customFetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
  }),
  responded: {
    onSuccess(response, method) {
      if (isUnauthorized(response.status)) {
        return doRefreshAndRetry(method)
      }
      return response.json().then((json) => json.data ?? json)
    },
    onError(error, method) {
      if (isUnauthorized(error.status)) {
        return doRefreshAndRetry(method)
      }
      throw error
    },
  },
})
```

### Token 刷新机制

```
401/403 响应
    │
    ├─ 检查是否在登录页
    │     ├── 是 → 直接抛出错误
    │     └── 否 → 尝试刷新 Token
    │               ├─ 刷新成功 → 重试原请求
    │               └─ 刷新失败 → 清除认证状态 → 重定向到登录页
```

---

## 常见错误

| 错误模式 | 正确做法 |
|----------|----------|
| 在 Zustand 中存储大量列表数据 | 使用 alova 处理服务端数据 |
| 直接修改 Zustand state | 使用 set 函数更新状态 |
| 在组件中直接调用 alova | 通过 services.ts 封装 |
| 忽略认证状态初始化 | 使用 waitForAuthInit 等待状态初始化 |
| 在 useEffect 中同步读取 Zustand state | 使用 selector 或 useEffect 依赖数组 |