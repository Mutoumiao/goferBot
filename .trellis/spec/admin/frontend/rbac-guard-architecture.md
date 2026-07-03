# Admin RBAC 守卫开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/admin/spec.md](../../../../openspec/specs/admin/spec.md) 和 [openspec/specs/auth/spec.md](../../../../openspec/specs/auth/spec.md)（WHAT）。19 权限码 / 3 预置角色集 / 三层守卫编排流 / Token 自动刷新订阅者队列模式 / mustChangePassword 流 应以 OpenSpec 为准。

---

## Purpose

帮助开发者在 Admin RBAC 三层守卫体系中高效工作：理解路由守卫编写约定、菜单过滤 Hook 集成、组件级权限控制、Token 自动刷新并发去重实现，以及认证状态持久化的安全设计要点。

## Primary OpenSpec

- [openspec/specs/admin/spec.md](../../../../openspec/specs/admin/spec.md) — Admin RBAC 权限模型（19 权限码、3 预置角色集、管理员认证、用户/角色/审计管理）
- [openspec/specs/auth/spec.md](../../../../openspec/specs/auth/spec.md) — 认证与 Token 刷新（JWT 双密钥、Token Rotation 与重放检测、jti 哈希安全）

## Related OpenSpec

- [openspec/specs/user/spec.md](../../../../openspec/specs/user/spec.md) — 用户角色定义

## Module Dependencies

- **TanStack Router** — `beforeLoad` 路由守卫机制
- **Zustand**（含 `persist` 中间件）— 认证状态管理与本地持久化
- **alova** — HTTP 客户端，`responded` 拦截器承载 Token 刷新逻辑
- **jsencrypt** — RSA 密码加密

## Development Entry

| 入口 | 文件路径 | 作用 |
|------|----------|------|
| Layer 1 路由守卫 | `packages/admin/src/routes/_authenticated.tsx` | `beforeLoad` 编排认证/权限/强制改密检查 |
| Layer 2 菜单过滤 | `packages/admin/src/components/layout/MenuConfig.tsx` | `useMenuConfig` Hook 按权限过滤导航项 |
| Layer 3 组件级 | `packages/admin/src/features/roles/components/PermissionMatrix.tsx` | 角色权限矩阵双向绑定 |
| Token 刷新 | `packages/admin/src/utils/auth-token.ts` | 订阅者队列实现 |
| 认证守卫工具 | `packages/admin/src/utils/auth-guard.ts` | `waitForAuthInit` / `getRouteMeta` / `hasAnyPermission` |
| 路由注册表 | `packages/admin/src/router-register.ts` | 路由元数据集中维护 |
| 认证 Store | `packages/admin/src/stores/auth.ts` | Zustand persist 状态 |
| 登录服务 | `packages/admin/src/features/auth/services.ts` | RSA 加密 + 重试 |

## Implementation Notes

### beforeLoad 路由守卫编写模式

按固定顺序执行四步检查，任一失败即 `throw redirect`：
1. `await waitForAuthInit()` — 等待 Zustand persist hydration 完成
2. 检查 `snapshot.isAuthenticated` — 否则跳 `/login`（携带 `buildLoginRedirectSearch` 回跳参数）
3. 检查 `getRouteMeta(pathname).requiredPermission` 与 `hasAnyPermission` — 否则跳 `/403`
4. 检查 `snapshot.user?.mustChangePassword` — 否则跳 `/profile`

执行顺序：`init → authenticated → permission → mustChangePassword → render`。新增守卫步骤必须插入到此顺序的合适位置，不得跳过前置检查。

### waitForAuthInit 轮询模式

- 50ms 间隔轮询 `useAuthStore.getState()._hydrated && isInitialized`
- 3s 超时后**强制 `setInitialized(true)`**，防止 localStorage 损坏导致永久白屏
- 考虑 SSR 场景下 localStorage 不可用的容错

### useMenuConfig Hook 集成

- 从 `useAuthStore` 订阅 `permissions` 与 `mustChangePassword`
- mustChangePassword 模式下仅返回 `[PROFILE_ROUTE]`
- 否则从 `ROUTES_REGISTER` 过滤：`r.nav && (!r.requiredPermission || permissions.includes(r.requiredPermission))`

### PermissionMatrix 组件级权限控制

- 用于角色编辑页，后端 `permissions` → 前端 `selected` state；前端修改 → 提交回后端
- 不要在业务页面用它做按钮级权限控制；按钮级请直接调 `hasAnyPermission` 或 `useAuthStore` 订阅

### Token 刷新订阅者队列实现

模块级两个变量：`isRefreshing`（互斥锁）+ `refreshSubscribers`（等待回调数组）。
- 第一个 401：置 `isRefreshing=true`，执行刷新，完成后 `forEach` 通知等待者并清空数组
- 后续 401：`push` 一个返回 Promise 的回调到队列，等待新 token 后重试
- 实现要点：批量并发请求只触发一次 refresh，避免竞态导致多次刷新

### 路由注册表集中管理

`ROUTES_REGISTER` 单点维护路由元数据（`path` / `nav` / `label` / `icon` / `requiredPermission`），路由守卫、菜单过滤、面包屑均复用此注册表。新增路由必须在此登记，否则守卫拿不到 `requiredPermission`。

### getRouteMeta 与 hasAnyPermission 使用

- `getRouteMeta(pathname)` 从 `ROUTES_REGISTER` 查询路由元数据
- `hasAnyPermission(snapshot, [perm])` 判断用户是否拥有任一权限
- 二者结合用于 beforeLoad 与组件级判定

### Zustand Persist + HttpOnly Cookie 安全设计

- `partialize` 仅持久化 `{ user, isAuthenticated }` 到 localStorage
- Token 通过 **HttpOnly Cookie** 管理（`credentials: 'include'`），不进 localStorage
- `onRehydrateStorage` 钩子在页面刷新后用 refreshToken 验证身份，失败则 `clearAuth()`
- 登出 `clearAuth()` 删 localStorage + 调 logout API

### RSA 加密重试

登录流先取公钥再 RSA 加密密码；若后端返回 `DECRYPT_FAILED`，清公钥缓存后重试一次（应对公钥过期）。

### 根路由入口分流

`/` 路由 `beforeLoad` 中：`waitForAuthInit` → 已认证跳 `/dashboard`，否则跳 `/login`。

## Testing Checklist

- [ ] 未认证用户访问受保护路由被重定向到 `/login`，回跳参数正确
- [ ] 无权限用户被重定向到 `/403`
- [ ] mustChangePassword 用户被重定向到 `/profile`
- [ ] mustChangePassword 模式下菜单仅显示 profile 入口
- [ ] 菜单正确过滤无权限项，保留有权限项
- [ ] PermissionMatrix 正确反映并回写角色权限
- [ ] 并发多个 401 请求只触发一次 refresh，全部请求被重试
- [ ] waitForAuthInit 超时后能强制初始化，不白屏
- [ ] 登出后 localStorage 与 Cookie 同步清除
- [ ] 公钥过期场景下登录自动重试一次成功

## Review Checklist

- [ ] 新增权限码是否同步更新 OpenSpec（admin/spec.md 权限码体系场景）
- [ ] 新增/调整角色权限集是否同步更新 OpenSpec
- [ ] 守卫编排流变更（新增/重排步骤）是否同步更新 OpenSpec
- [ ] mustChangePassword 流变更是否同步更新 OpenSpec
- [ ] Token 刷新机制变更是否同步更新 auth/spec.md
- [ ] 新增路由是否登记到 `ROUTES_REGISTER`
- [ ] `partialize` 是否避免持久化敏感字段

## Common Pitfalls

- **跳过 waitForAuthInit**：persist 未 hydrate 时 `isAuthenticated` 恒为 false，会把已登录用户误踢到 `/login`。守卫第一步必须等待。
- **超时不强制初始化**：localStorage 损坏时页面永久白屏。超时分支必须 `setInitialized(true)`。
- **守卫顺序错乱**：mustChangePassword 检查必须在权限检查之后，否则无权限的强制改密用户会被踢到 `/403` 而非 `/profile`。
- **Token 刷新未做互斥**：并发 401 会触发多次 refresh，刷新旧 token 导致后续请求全部失败。必须用 `isRefreshing` 互斥锁 + 订阅者队列。
- **Token 进 localStorage**：XSS 可读。Token 必须只在 HttpOnly Cookie。
- **路由未登记注册表**：守卫拿不到 `requiredPermission`，等同于无权限保护。新路由必须登记。
- **PermissionMatrix 滥用**：它是角色编辑专用组件，不要在业务页面用作按钮级权限控制。
- **RSA 公钥不缓存清理**：DECRYPT_FAILED 后未清缓存会死循环（重试又用旧公钥）。重试前必须 `clearPublicKeyCache`。

## Reusable Patterns

- **beforeLoad 路由守卫模式**：四步顺序检查 + `throw redirect` 中断，适用于所有受保护路由
- **订阅者队列并发去重模式**：`isRefreshing` 互斥锁 + `refreshSubscribers` 数组，适用于任何"首个请求触发、其余等待复用结果"的并发场景
- **Zustand persist 安全持久化模式**：`partialize` 白名单 + HttpOnly Cookie 存敏感凭证，适用于所有前端认证状态
- **集中路由注册表模式**：路由元数据单点维护，守卫/菜单/面包屑复用，适用于多消费方场景
- **超时强制降级模式**：轮询等待 + 超时强制推进，防止依赖未就绪导致永久卡死
- **RSA 加密 + 单次重试模式**：公钥可能过期的加密场景，失败清缓存重试一次
