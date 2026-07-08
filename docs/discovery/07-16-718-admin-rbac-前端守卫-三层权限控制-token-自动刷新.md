# GoferBot Discovery Report

## 7. 复杂模块

### 7.18 Admin RBAC 前端守卫 — 三层权限控制 + Token 自动刷新

**数据来源**：[auth-guard.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/auth-guard.ts)、[_authenticated.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/routes/_authenticated.tsx)、[server.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/server.ts)、[auth.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/stores/auth.ts)、[router-register.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/router-register.ts)、[permissions.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/constants/permissions.ts)、[MenuConfig.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/components/layout/MenuConfig.tsx)

Admin 前端 RBAC 实现**三层权限控制**，与后端 §7.4 RBAC 权限系统形成前后端联动的完整安全边界。

> **v22 重大修正**：移除 `isAuthenticated` localStorage 持久化，`waitForAuthInit` 改为调用 `/auth/me`（single-flight）服务端验证；用户模型从 `role: string` 改为 `roles: string[]` + `permissions: string[]`；403 不再触发 token refresh。

#### 第一层：路由守卫（TanStack Router beforeLoad）

`_authenticated.tsx` 的 `beforeLoad` 在每次导航前执行：

```
waitForAuthInit()
  → hydration 完成 → fetchMe() 调用 GET /auth/me（single-flight Promise）
    → 200: setUser(data) → 写入 roles + permissions + user
    → 401: 尝试 refresh → refresh 成功重试 fetchMe → 失败 clearAuth → resolve(false)
    → 超时 3s → resolve(false)
  → resolve(false)? → redirect /login（携带 ?redirect=原URL）
  → resolve(true)?
    → 无路由 requiredPermission → 正常渲染
    → hasPermission(permissions) → SUPER_ADMIN 直接通过 → 否则检查 permissions 交集
    → 无权限 → redirect /forbidden
```

`fetchMe()` ([auth.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/stores/auth.ts)): single-flight Promise 调用 `/auth/me`，所有并发 beforeLoad 共享同一请求。`localStorage` 仅持久化 `user` 对象作为 hydration 缓存（非信任源），不再存 `isAuthenticated`。

`buildLoginRedirectSearch()` ([auth-guard.spec.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/auth-guard.spec.ts#L119-L129)): 防御 `null` 原型 search 对象崩溃（`Object.create(null)` 无 `toString`），使用 `location.href` 而非 `location.search` 拼接参数。

#### 第二层：菜单动态过滤

`useMenuConfig()` ([MenuConfig.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/components/layout/MenuConfig.tsx#L16-L50)): 从 `ROUTES_REGISTER`（14 条路由元数据）中筛选：

- `!r.nav` → 排除非导航路由（login/changePassword 等）
- `r.requiredPermission && !permissions.includes(r.requiredPermission)` → 排除无权限路由
- `mustChangePassword` 模式 → 仅显示 profile

权限变更后菜单**实时响应**（useMemo 依赖 `user`），无需刷新页面。

#### 第三层：组件级权限（PermissionMatrix）

`PermissionMatrix` ([PermissionMatrix.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/roles/components/PermissionMatrix.tsx)): 按 `group` 分组的 Checkbox 权限矩阵，支持：

- 双向绑定：`fetchRole` → `setSelected(permissions)` → 用户勾选 → `setSelected`
- Dirty 检测：`selected.join(',') !== role.permissions.join(',')` → 显示"保存修改"
- 保存：调用 `updateRoleService(id, { permissions: selected })`

#### 路由-权限映射表

`ROUTES_REGISTER` ([router-register.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/router-register.ts)) 集中管理路由元数据：

| 路由 | requiredPermission | nav |
|------|-------------------|-----|
| /dashboard | dashboard | true |
| /users | users | true |
| /users/$id | users | false |
| /roles | roles | true |
| /roles/$id | roles | false |
| /invitations | invitations | true |
| /audit | audit | true |
| /profile | profile | false |
| /model-providers | modelProviders | true |
| /module-settings | moduleSettings | true |
| /login | - | false |

**v22 移除**：`/sessions`、`/sessions/$id`、`/rag-observability` 路由（后续通过 Tracing 实现）。移除 `mustChangePassword` 相关路由和逻辑。

#### Token 自动刷新 — 订阅者队列模式（v22 修正）

alova `responded` 拦截器 ([server.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/server.ts)):

```
HTTP 401（非登录页）
  → NO_AUTH_TOKEN code? → 直接 clearAuth + redirect /login（不调用 refresh）
  → AUTH_ERROR? → isRefreshing? 
      否 → doRefreshAndRetry(method):
            isRefreshing=true → fetch /auth/admin/refresh (credentials:include)
              → ok? onRefreshed() → refreshSubscribers.forEach(cb => cb())
              → fail? clearAuth() → window.location.replace('/login')
      是 → addSubscriber(cb) → 等待 onRefreshed() 后重发
  → 防重复刷新：refreshedMethods WeakSet 防止 401 重试后无限刷新循环

HTTP 403 → 直接抛错 route /forbidden，不触发 refresh（v22 修复）
```

- **互斥锁** `isRefreshing`: 确保只有一个请求执行 refresh
- **订阅者队列** `refreshSubscribers[]`: 等待中的请求不会重复刷新，而是订阅刷新完成事件后批量重发
- **HttpOnly Cookie 认证**: `refresh({ refreshToken: '' })` — 空字符串，后端从 Cookie 读取；所有请求通过 `credentials: 'include'`
- **X-App-Context 头**: 请求拦截器统一添加 `X-App-Context: admin`，解决双 Cookie 优先级判定

**错误解析** ([server.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/utils/server.ts)): 兼容两种后端错误格式 `{ error: { code, message } }` 和 `{ code, message }`，提取 code/message 注入 Error 对象。正常响应自动解包 `response.json().data ?? response.json()`。

#### Auth 状态持久化（v22 修正）

Zustand `persist` middleware ([auth.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/stores/auth.ts)):

- **存储位置**: `localStorage('goferbot-admin-auth')`
- **partialize**: 仅持久化 `{user}`（`roles: string[], permissions: string[]`），Token 由 HttpOnly Cookie 承载
- **移除持久化**: `isAuthenticated` 不再持久化到 localStorage，以服务端 `/auth/me` 为唯一信任源
- **onRehydrateStorage**: hydration 完成后仅设 `_hydrated=true`，不自动 setInitialized — 由 `fetchMe()` 结果驱动
- **clearAuth**: 同时清除 `localStorage` 和 Zustand state，不做 window.location 跳转（由路由守卫处理）

#### 登录与会话恢复

**登录流程** ([auth/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/auth/services.ts#L26-L71)):

```
输入邮箱+密码
  → RSA 公钥加密密码（encryptPassword）
  → POST /admin/auth/login (email, encryptedPassword, captcha?)
    → 成功: setUser({...user, mustChangePassword?})
    → DECRYPT_FAILED: 清除公钥缓存 → 重试一次
    → 其他失败: toast 错误消息
```

**会话恢复** ([auth/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/auth/services.ts#L84-L96)): `fetchCurrentUser()` → GET `/auth/me` → 成功则 `setUser()`，401/403 则 `clearAuth()`。

#### 前端权限常量

`PERMISSIONS` ([permissions.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/constants/permissions.ts)): 21 个权限码，分 7 组（dashboard / users:read+create+update+delete+resetPassword / roles:read+create+update+delete / invitations:read+create+revoke / audit:read+export / settings:read+update / system:metrics+maintenance+logs）。

权限常量已迁移到 `@goferbot/data` 共享包，前后端对齐。前端 `PERMISSIONS` 从共享包导出。

`ROLE_PERMISSIONS`: 3 角色预设权限集（前端硬编码，作为初始参考）:

| 角色 | 权限数 | 详情 |
|------|--------|------|
| super_admin | 21 | 全部权限 + 通配符 `*`（前端显示"全部权限"且不可编辑） |
| admin | ~14 | 无 users:delete/roles:*delete 等敏感操作 |
| user | 2 | dashboard + profile |

> 实际权限以后端 `/admin/permissions` 返回为准，`ROLE_PERMISSIONS` 仅为前端预设常量。roleCode 统一为小写 snake_case。

#### 与后端 RBAC 的联动

```
前端 (_authenticated beforeLoad)           后端 (JwtAuthGuard → PermissionGuard)
  ┌─────────────────────────┐              ┌──────────────────────────────┐
  │ waitForAuthInit()       │              │ JWT Cookie 验证              │
  │ getAuthSnapshot()       │              │ JwtStrategy.validate()       │
  │ hasAnyPermission(...)   │   HTTP 200   │ PermissionGuard              │
  │  └─ route 可访问        │ ◄─────────── │  └─ 403 不可访问             │
  │  └─ menu 可见           │              │                              │
  └─────────────────────────┘              └──────────────────────────────┘
```

前后端权限码一致（如 `users:read`, `roles:update`），共享 `packages/data` 的 Zod Schema 类型约束。

***
