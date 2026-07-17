# Hook 指南

> 本项目中 hooks 的使用方式。

---

## 概述

项目使用 **alova** 进行数据获取，结合 React 内置 Hooks 和自定义 Hooks 管理状态和副作用。数据获取通过 alova 的 `useRequest` 封装，全局状态通过 Zustand 管理。

---

## 自定义 Hook 模式

### 创建自定义 Hook

自定义 Hook 必须以 `use` 开头，遵循 React Hooks 规则：

```tsx
import { useState, useCallback } from 'react'

export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue)
  
  const toggle = useCallback(() => setValue((v) => !v), [])
  const setTrue = useCallback(() => setValue(true), [])
  const setFalse = useCallback(() => setValue(false), [])
  
  return { value, toggle, setTrue, setFalse }
}
```

### Hook 目录结构

```
features/
└── chat/
    ├── hooks.ts           # 模块专属 hooks
    └── components/
        └── ChatPage.tsx   # 使用 hooks 的组件

features/
└── auth/
    ├── hooks/
    │   └── usePasswordStrength.ts  # 密码强度检查 hook
    └── ...
```

### Hook 职责边界

| Hook 类型 | 职责 | 示例 |
|-----------|------|------|
| **数据获取** | 封装 alova `useRequest`，处理分页、加载态、错误 | `useChatHistory` |
| **状态管理** | 封装本地状态或 Zustand store | `useOverlay` |
| **副作用** | 封装复杂副作用逻辑 | `usePasswordStrength` |
| **组合 Hook** | 组合多个 hooks 提供更高级的功能 | `useChatProvider` |

---

## 数据获取

### alova useRequest

项目使用 alova 的 `useRequest` 进行数据获取，统一处理异步请求的加载态、错误和刷新：

```tsx
import { useRequest } from 'alova/client'
import { getSessions } from '@/api/chat'

export function useChatHistory(page: number, pageSize: number) {
  const { data, loading, error, send: reload } = useRequest(
    () => getSessions(page, pageSize),
    { immediate: true }
  )
  
  return { data, loading, error, reload }
}
```

### 立即加载 vs 延迟加载

根据使用场景选择：

```tsx
// 立即加载 — 页面挂载时自动触发
const { data, loading } = useRequest(() => getSessions(), { immediate: true })

// 延迟加载 — 手动调用 load/reload 触发
const { load, reload } = useRequest(() => getSessions(), { immediate: false })
```

### 分页加载模式

```tsx
import type { PaginationType, Session, SessionListResponse } from '@goferbot/data'
import { useRequest } from 'alova/client'
import { useMemo } from 'react'
import { getSessions } from '@/api/chat'

export function useChatHistory(page: number, pageSize: number) {
  const { data, loading, error, send: reload } = useRequest(
    () => getSessions(page, pageSize),
    { immediate: true }
  )
  
  return useMemo(() => {
    const responseData = data as SessionListResponse | undefined
    return {
      sessions: responseData?.items ?? [],
      pagination: responseData?.pagination ?? null,
      loading,
      error,
      reload: reload as () => Promise<SessionListResponse | undefined>,
    }
  }, [data, loading, error, reload])
}
```

### 请求缓存

alova 实例配置了 `shareRequest: true`，相同请求会自动合并：

```tsx
// 多个组件调用相同的 API，只会发起一次请求
const { data: user1 } = useRequest(getMe, { immediate: true })
const { data: user2 } = useRequest(getMe, { immediate: true })
```

---

## 命名约定

### Hook 命名规则

| 规则 | 示例 |
|------|------|
| 必须以 `use` 开头 | `useChatHistory`, `usePasswordStrength` |
| 使用 camelCase | `useLazyChatHistory`, `useOverlay` |
| 描述功能或状态 | `useToggle`, `useAuth`, `useSettings` |

### 文件命名规则

| 场景 | 规则 | 示例 |
|------|------|------|
| 单一 Hook 文件 | `useHookName.ts` | `usePasswordStrength.ts` |
| 多个 Hook 文件 | `hooks.ts` | `features/chat/hooks.ts` |
| Hook 目录 | `hooks/` | `features/auth/hooks/` |

---

## 共享有状态逻辑

### 使用 Zustand 共享全局状态

全局状态通过 Zustand store 管理，自定义 Hook 封装 store 使用：

```tsx
// stores/auth.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
  clearAuth: () => set({ user: null, isAuthenticated: false }),
}))
```

### 在组件中使用

```tsx
import { useAuthStore } from '@/stores/auth'

function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore()
  
  if (!isAuthenticated) {
    // 未认证处理
    return null
  }
  
  return <div>Welcome, {user?.name}</div>
}
```

### 选择器优化

使用 Zustand 选择器避免不必要的重渲染：

```tsx
// ✅ 推荐：使用选择器
const userName = useAuthStore((state) => state.user?.name)

// ❌ 不推荐：订阅整个 store
const { user } = useAuthStore()
```

---

## 常用自定义 Hooks

### useOverlay — 命令式弹窗

```tsx
import { openDialog, closeDialog, openContextMenu, closeContextMenu, closeAll } from '@/overlays/services/overlay-service'

export function useOverlay() {
  return {
    dialog: openDialog,
    closeDialog,
    contextMenu: openContextMenu,
    closeContextMenu,
    closeAll,
  } as const
}
```

### usePasswordStrength — 密码强度检查

```tsx
import { useMemo } from 'react'

export function usePasswordStrength(password: string) {
  const strength = useMemo(() => {
    // 密码强度计算逻辑
    if (password.length < 8) return 0
    if (!/[A-Z]/.test(password)) return 1
    if (!/[0-9]/.test(password)) return 2
    if (!/[^A-Za-z0-9]/.test(password)) return 3
    return 4
  }, [password])
  
  return {
    strength,
    label: ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strength],
  }
}
```

---

## 错误处理

### 数据获取错误

```tsx
const { data, loading, error, reload } = useRequest(() => getSessions())

if (loading) return <Spinner />
if (error) {
  return (
    <div>
      Error: {error.message}
      <Button onClick={reload}>Retry</Button>
    </div>
  )
}

return <SessionList sessions={data} />
```

### alova 全局错误处理

alova 实例配置了全局错误处理，统一处理 HTTP 错误和认证失败：

```tsx
// utils/server.ts
const responded = {
  onSuccess(response, method) {
    if (!response.ok) {
      // 解析错误信息并抛出
      return response.json().then((json) => {
        const message = json.error?.message || `HTTP ${response.status}`
        throw new Error(message)
      })
    }
    return response.json().then((json) => json.data ?? json)
  },
  onError(error, method) {
    if (error.status === 401 || error.status === 403) {
      // 自动刷新 token 或重定向登录
      return doRefreshAndRetry(method)
    }
    throw error
  },
}
```

---

## 常见错误

### 错误示例

| 错误 | 描述 | 修复方式 |
|------|------|----------|
| Hook 命名不以 `use` 开头 | `function toggle()` | `function useToggle()` |
| 在条件语句中调用 Hook | `if (condition) { useHook() }` | 将 Hook 调用移到顶层 |
| 未使用选择器订阅 Zustand | `const { user } = useAuthStore()` | `const user = useAuthStore((s) => s.user)` |
| 直接在组件中调用 API | `fetch('/api/data').then(...)` | 使用 alova `useRequest` |
| Hook 中缺少依赖项 | `useEffect(() => {...}, [])` | 正确声明依赖项 |

### 正确示例

```tsx
// ✅ 正确：遵循 Hooks 规则 + 使用选择器
import { useAuthStore } from '@/stores/auth'
import { useChatHistory } from '@/features/chat/hooks'

function ChatsListHookExample() {
  const userId = useAuthStore((s) => s.user?.id)
  // 生产路径优先 useLazyChatHistory（由 Keep-Alive 边界手动 load）
  const { sessions, loading, error, reload } = useChatHistory(1, 20)

  useEffect(() => {
    if (userId) {
      void reload()
    }
  }, [userId, reload])

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={reload} />

  return <SessionListPanel sessions={sessions} onSelect={...} onNewChat={...} />
}
```

---

## 代码引用

| 规范 | 参考文件 |
|------|----------|
| alova 实例配置 | `packages/web/src/utils/server.ts` |
| useRequest 使用示例 | `packages/web/src/features/chat/hooks.ts` |
| useOverlay Hook | `packages/web/src/overlays/hooks/useOverlay.ts` |
| usePasswordStrength Hook | `packages/web/src/features/auth/hooks/usePasswordStrength.ts` |
| Zustand store | `packages/web/src/stores/auth.ts` |