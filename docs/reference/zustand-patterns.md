# Zustand 迁移参考

> 用于 GoferBot 前端迁移，覆盖 Store 定义、异步 action、持久化、与 TanStack Query 的配合。
> 整理日期：2026-06-05

---

## 1. 基础 Store 定义

### 1.1 简单 Store

```ts
import { create } from 'zustand'

interface CounterState {
  count: number
  increment: () => void
  decrement: () => void
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}))
```

### 1.2 带初始化的 Store

```ts
interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserDTO | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  init: () => void
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  clearTokens: () => void
  fetchMe: () => Promise<UserDTO | null>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  init: () => {
    const access = localStorage.getItem('goferbot_access_token')
    const refresh = localStorage.getItem('goferbot_refresh_token')
    if (access && refresh) {
      set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
      // 验证 token 有效性
      get().fetchMe().catch(() => get().clearTokens())
    }
  },

  login: async (credentials) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.post<AuthResponse>('/api/auth/login', credentials)
      set({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
        isAuthenticated: true,
      })
      localStorage.setItem('goferbot_access_token', res.accessToken)
      localStorage.setItem('goferbot_refresh_token', res.refreshToken)
    } catch (e) {
      set({ error: mapAuthError(e) })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    try {
      const token = get().accessToken
      if (token) {
        await api.post('/api/auth/logout', {})
      }
    } finally {
      get().clearTokens()
    }
  },

  clearTokens: () => {
    localStorage.removeItem('goferbot_access_token')
    localStorage.removeItem('goferbot_refresh_token')
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    })
  },

  fetchMe: async () => {
    const token = get().accessToken
    if (!token) return null
    try {
      const res = await api.get<{ data: UserDTO }>('/api/auth/me')
      set({ user: res.data })
      return res.data
    } catch (e) {
      get().clearTokens()
      throw e
    }
  },
}))
```

---

## 2. 在组件中使用

### 2.1 选择单个状态（推荐）

```tsx
export function UserProfile() {
  // 只订阅 user，user 变化时才重渲染
  const user = useAuthStore((state) => state.user)
  
  return <div>{user?.name}</div>
}
```

### 2.2 选择多个状态

```tsx
import { shallow } from 'zustand/shallow'

export function AuthStatus() {
  const { isAuthenticated, isLoading } = useAuthStore(
    (state) => ({ isAuthenticated: state.isAuthenticated, isLoading: state.isLoading }),
    shallow
  )
  
  if (isLoading) return <Loading />
  return isAuthenticated ? <UserMenu /> : <LoginButton />
}
```

### 2.3 调用 Action

```tsx
export function LoginForm() {
  const login = useAuthStore((state) => state.login)
  const isLoading = useAuthStore((state) => state.isLoading)

  async function handleSubmit(data: LoginCredentials) {
    try {
      await login(data)
      // 登录成功后的逻辑
    } catch (e) {
      // 错误处理
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Login'}
      </Button>
    </form>
  )
}
```

---

## 3. 持久化

### 3.1 基础持久化

```ts
import { persist } from 'zustand/middleware'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      // ... actions
    }),
    {
      name: 'auth-storage',
      // 只持久化特定字段
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
```

### 3.2 自定义存储（如 sessionStorage）

```ts
import { persist, createJSONStorage } from 'zustand/middleware'

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      // ...
    }),
    {
      name: 'session-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
```

---

## 4. 与 TanStack Query 配合

### 4.1 服务端状态用 Query，客户端状态用 Zustand

```ts
// 服务端状态：用 TanStack Query
function useUser(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })
}

// 客户端状态：用 Zustand
interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}))
```

### 4.2 在 Query 中调用 Zustand Action

```tsx
export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth)
  
  return useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      setAuth(data)
    },
  })
}
```

---

## 5. 多 Store 组合

### 5.1 按领域拆分

```ts
// stores/auth.ts
export const useAuthStore = create<AuthState>(...)

// stores/settings.ts
export const useSettingsStore = create<SettingsState>(...)

// stores/ui.ts
export const useUIStore = create<UIState>(...)
```

### 5.2 Store 间调用

```ts
export const useSettingsStore = create<SettingsState>((set, get) => ({
  config: null,
  
  loadConfig: async () => {
    // 从 auth store 获取 token
    const token = useAuthStore.getState().accessToken
    if (!token) return
    
    const config = await api.get('/api/settings')
    set({ config })
  },
}))
```

---

## 6. 与 Vue Pinia 的对比

| 特性 | Pinia | Zustand |
|------|-------|---------|
| Store 定义 | `defineStore('id', () => {...})` | `create<State>((set, get) => {...})` |
| 状态读取 | `store.count` | `useStore((state) => state.count)` |
| 状态修改 | `count.value++` | `set({ count: state.count + 1 })` |
| 计算属性 | `computed(() => ...)` | 在 selector 中计算或使用 `useMemo` |
| 持久化 | `pinia-plugin-persistedstate` | `zustand/middleware` |
| HMR | `acceptHMRUpdate` | `vite-plugin-zustand` 或手动 |
| 多 Store | 多个 `defineStore` | 多个 `create` |
| 无 Provider | ✅ | ✅ |

---

## 7. 常见问题

### Q: 如何避免不必要的重渲染？

```tsx
// ✅ 只订阅需要的字段
const count = useStore((state) => state.count)

// ❌ 订阅整个 store
const { count, name, email } = useStore()
```

### Q: 如何在组件外读取状态？

```ts
const token = useAuthStore.getState().accessToken
```

### Q: 如何监听状态变化？

```ts
useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated !== prevState.isAuthenticated) {
    console.log('Auth state changed')
  }
})
```

---

## 参考

- [Zustand 官方文档](https://docs.pmnd.rs/zustand)
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [TanStack Query 文档](https://tanstack.com/query/latest)
