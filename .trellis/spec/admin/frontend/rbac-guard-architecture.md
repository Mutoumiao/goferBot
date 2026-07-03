# Admin RBAC 前端守卫架构

> Admin 后台的三层 RBAC 权限守卫体系、Token 自动刷新和认证状态管理。

---

## 概述

Admin 前端实现**三层权限控制**，从前端路由到组件级全覆盖：

```
Layer 1: 路由守卫 (beforeLoad)
  → 阻止未认证/无权限访问页面
Layer 2: 菜单过滤 (useMenuConfig)
  → 动态隐藏无权限菜单项
Layer 3: 组件级权限 (PermissionMatrix)
  → 细粒度控制页面内操作权限
```

---

## 三层架构详解

### Layer 1: 路由守卫（beforeLoad）

```typescript
// packages/admin/src/routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // Step 1: 等待认证模块初始化
    await waitForAuthInit()   // 3s 超时，50ms 轮询

    // Step 2: 检查是否已认证
    const snapshot = getAuthSnapshot()
    if (!snapshot.isAuthenticated) {
      throw redirect({ to: '/login', search: buildLoginRedirectSearch(location) })
    }

    // Step 3: 检查路由所需权限
    const routeMeta = getRouteMeta(location.pathname)
    if (routeMeta.requiredPermission) {
      if (!hasAnyPermission(snapshot, [routeMeta.requiredPermission])) {
        throw redirect({ to: '/403' })
      }
    }

    // Step 4: 检查是否需要强制修改密码
    if (snapshot.user?.mustChangePassword) {
      throw redirect({ to: '/profile' })
    }
  },
})
```

守卫执行顺序：`init → authenticated → permission → mustChangePassword → render`

### waitForAuthInit 轮询

```typescript
// packages/admin/src/utils/auth-guard.ts
export async function waitForAuthInit(timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const state = useAuthStore.getState()
    if (state._hydrated && state.isInitialized) return
    await new Promise((r) => setTimeout(r, 50))  // 50ms 轮询
  }
  // 超时强制初始化，防止页面永久白屏
  useAuthStore.getState().setInitialized(true)
}
```

**关键设计**：
- 50ms 轮询检查 Zustand `persist` hydration 是否完成
- 3s 超时后**强制初始化**（防止 localStorage 损坏导致永久白屏）
- 考虑到 SSR 场景下 localStorage 不可用

### Layer 2: 菜单过滤（useMenuConfig）

```typescript
// packages/admin/src/components/layout/MenuConfig.tsx
export function useMenuConfig() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? [])
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword)

  // mustChangePassword 模式：仅显示 profile
  if (mustChangePassword) {
    return [PROFILE_ROUTE]
  }

  // 从 ROUTES_REGISTER 动态过滤菜单
  return ROUTES_REGISTER.filter((r) =>
    r.nav &&                                    // 可导航
    (!r.requiredPermission ||                   // 无权限要求
     permissions.includes(r.requiredPermission))  // 或用户拥有权限
  )
}
```

### Layer 3: 组件级权限（PermissionMatrix）

`PermissionMatrix` 组件用于角色编辑页面，显示角色拥有的权限并通过 checkbox 双向绑定：

```typescript
// 后端返回角色的 permissions → 前端设置 selected state
// 前端修改 selected → 提交时发送给后端
```

---

## ROUTES_REGISTER 集中路由注册

```typescript
// packages/admin/src/router-register.ts
const ROUTES_REGISTER: RouteMeta[] = [
  { path: '/dashboard', nav: true, label: '仪表盘', icon: LayoutDashboard, requiredPermission: null },
  { path: '/users', nav: true, label: '用户管理', icon: Users, requiredPermission: 'users:read' },
  { path: '/roles', nav: true, label: '角色管理', icon: Shield, requiredPermission: 'roles:read' },
  { path: '/audit', nav: true, label: '审计日志', icon: FileText, requiredPermission: 'audit:read' },
  { path: '/settings', nav: true, label: '系统设置', icon: Settings, requiredPermission: 'settings:read' },
  // ... 14 条路由
]
```

**集中管理的优势**：路由守卫 + 菜单过滤 + 面包屑都复用此注册表，单点维护。

---

## Token 自动刷新（订阅者队列模式）

### 核心机制

```typescript
// packages/admin/src/utils/server.ts
let isRefreshing = false            // 互斥锁
let refreshSubscribers: Array<(token: string) => void> = []  // 等待队列

// alova responded 拦截器
responded: {
  onSuccess: async (response) => {
    if ([401, 403].includes(response.status)) {
      if (!isRefreshing) {
        // 第一个 401：执行刷新
        isRefreshing = true
        const newToken = await doRefreshAndRetry()
        isRefreshing = false
        // 通知所有等待者
        refreshSubscribers.forEach((cb) => cb(newToken))
        refreshSubscribers = []
        // 重试原请求
        return fetch(newConfig)
      } else {
        // 后续 401：进入等待队列
        return new Promise((resolve) => {
          refreshSubscribers.push((newToken) => {
            resolve(fetch({ ...config, headers: { Authorization: `Bearer ${newToken}` } }))
          })
        })
      }
    }
    return response
  },
}
```

### 流程图

```
请求 A（token 过期）→ 401 → isRefreshing=false → 触发 doRefreshAndRetry()
                                               → isRefreshing = true
请求 B（同时到达）→ 401 → isRefreshing=true  → 进入 refreshSubscribers 队列
请求 C（同时到达）→ 401 → isRefreshing=true  → 进入 refreshSubscribers 队列
                                               ↓
                              doRefreshAndRetry 完成 → 通知 A/B/C 重试
                                               → isRefreshing = false
```

**优势**：批量请求只触发一次 refresh，避免竞态条件导致多次刷新。

---

## Auth 状态持久化

### Zustand Persist + HttpOnly Cookie

```typescript
// packages/admin/src/stores/auth.ts
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      // ...
    }),
    {
      name: 'goferbot-admin-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,               // 仅持久化用户资料
        isAuthenticated: state.isAuthenticated,
      }),
      // Token 通过 HttpOnly Cookie 管理，不持久化到 localStorage
    }
  )
)
```

**安全设计**：
- `partialize` 只序列化 `{user, isAuthenticated}` 到 localStorage
- Token 通过 **HttpOnly Cookie** 管理（`credentials: 'include'`）
- 登出时 `clearAuth()` 删除 localStorage + 调用 logout API

### 登录流程

```typescript
// packages/admin/src/features/auth/services.ts
export async function loginService(params: LoginParams) {
  // 1. 获取 RSA 公钥
  const { publicKey } = await getPublicKey().send()

  // 2. RSA 加密密码
  const encryptedPassword = encryptPassword(params.password, publicKey)

  // 3. 登录
  try {
    const result = await login({ email: params.email, password: encryptedPassword }).send()
    useAuthStore.getState().setUser(result.user, result.mustChangePassword)
  } catch (e) {
    if (e.code === 'DECRYPT_FAILED') {
      // 公钥缓存过期，清除缓存后重试一次
      clearPublicKeyCache()
      return loginService(params)
    }
    throw e
  }
}
```

**RSA 加密重试**：如果加密失败（公钥过期），清除缓存后自动重试一次。

### 会话恢复

```typescript
// 页面刷新后：localStorage 中有 user + isAuthenticated=true
useAuthStore.persist.onRehydrateStorage(() => {
  // 用 HttpOnly Cookie 中的 refreshToken 验证身份
  fetchCurrentUser().then((user) => {
    useAuthStore.getState().setUser(user)
  }).catch(() => {
    // 验证失败：清除认证状态
    useAuthStore.getState().clearAuth()
  })
})
```

---

## 权限常量

### PERMISSIONS（19 个权限码）

```typescript
// packages/admin/src/constants/permissions.ts
export const PERMISSIONS = {
  // 用户管理
  'users:read': '查看用户',
  'users:create': '创建用户',
  'users:update': '更新用户',
  'users:delete': '删除用户',
  // 角色管理
  'roles:read': '查看角色',
  'roles:create': '创建角色',
  'roles:update': '更新角色',
  'roles:delete': '删除角色',
  // 审计日志
  'audit:read': '查看审计日志',
  'audit:export': '导出审计日志',
  // 系统设置
  'settings:read': '查看设置',
  'settings:update': '更新设置',
  // 系统
  'system:metrics': '查看指标',
  'system:maintenance': '维护模式',
  'system:logs': '查看日志',
  // API Keys
  'api-keys:read': '查看 API Keys',
  'api-keys:create': '创建 API Keys',
  'api-keys:update': '更新 API Keys',
  'api-keys:delete': '删除 API Keys',
} as const
```

### ROLE_PERMISSIONS（3 种预设角色）

| 角色 | 权限数量 | 包含权限 |
|------|---------|---------|
| `SUPER_ADMIN` | 18 项 | 全部（除保留项） |
| `ADMIN` | 14 项 | 无 `users:delete`、`roles:create/update/delete` |
| `USER` | 2 项 | `users:read`、`roles:read`（只读） |

---

## mustChangePassword 流

1. 后端登录返回 `mustChangePassword: true`
2. Auth store 设置 `user.mustChangePassword = true`
3. 路由守卫检测到 → 强制跳转 `/profile`
4. 菜单过滤仅显示 profile 入口
5. 修改密码后后端清除标志 → 恢复正常导航

---

## 根路由入口分流

```typescript
// packages/admin/src/routes/index.tsx
export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    await waitForAuthInit()
    const state = getAuthSnapshot()
    if (state.isAuthenticated) {
      throw redirect({ to: '/dashboard' })
    } else {
      throw redirect({ to: '/login' })
    }
  },
})
```

---

## 代码引用

| 规范 | 文件路径 |
|------|----------|
| 认证 Store | `packages/admin/src/stores/auth.ts` |
| 路由守卫 | `packages/admin/src/routes/_authenticated.tsx` |
| 认证守卫工具 | `packages/admin/src/utils/auth-guard.ts` |
| Token 刷新 | `packages/admin/src/utils/server.ts` (responded 拦截器) |
| 路由注册表 | `packages/admin/src/router-register.ts` |
| 菜单配置 | `packages/admin/src/components/layout/MenuConfig.tsx` |
| 权限常量 | `packages/admin/src/constants/permissions.ts` |
| 登录服务 | `packages/admin/src/features/auth/services.ts` |
| 根路由 | `packages/admin/src/routes/index.tsx` |
| 认证 API | `packages/admin/src/api/auth.ts` |
