> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为
> [openspec/specs/auth/spec.md](../../../openspec/specs/auth/spec.md)（WHAT）。
> 所有业务规则、API 契约、错误码、状态机定义以 OpenSpec 为准。

# Auth 模块开发指南

## 1. Purpose

本指南描述 auth 模块（认证与授权）的开发模式、实现要点、测试验证清单和常见陷阱。适用于：
- 新增认证相关端点或修改现有认证流程
- 修改权限控制逻辑
- 调试认证相关问题
- 扩展 RBAC 角色权限模型

## 2. Primary OpenSpec

- [openspec/specs/auth/spec.md](../../../openspec/specs/auth/spec.md) — 认证与授权业务规范
- [openspec/specs/invitation-codes/spec.md](../../../openspec/specs/invitation-codes/spec.md) — 邀请码系统规范

## 3. Related OpenSpec

- [openspec/specs/admin/spec.md](../../../openspec/specs/admin/spec.md) — 管理后台 RBAC、权限码、审计日志
- [openspec/specs/user/spec.md](../../../openspec/specs/user/spec.md) — 用户档案、密码策略、Super Admin Bootstrap

## 4. Related Trellis Guides

- [数据库指南](./database-guidelines.md) — Repository 模式、TransactionManager 用法
- [错误处理](./error-handling.md) — AppException 错误体系
- [质量指南](./quality-guidelines.md) — 代码清理规则、路径工具函数约定

## 5. When You Need To

阅读本指南当：
- 需要修改登录/注册/登出/refresh 流程
- 需要添加新的权限码或角色
- 需要修改 AppGuard 路径隔离逻辑
- 需要调试 Cookie 安全策略问题
- 需要修改 PermissionSeeder 预置角色或权限

## 6. Module Dependencies

| 依赖 | 说明 |
|------|------|
| `@nestjs/common` | NestJS 核心模块 |
| `@nestjs/passport` | Passport 认证框架 |
| `@nestjs/jwt` | JWT 生成与验证 |
| `passport-jwt` | JWT Passport Strategy |
| `bcrypt` | 密码哈希 |
| `@goferbot/data` | 共享类型定义 |
| `redis` | Auth Redis 独立连接 |
| `zod` | DTO 校验 |

## 7. Development Entry

| 文件 | 说明 |
|------|------|
| `packages/server/src/auth/auth.controller.ts` | 认证端点控制器（/auth/me、/auth/public-key、/auth/captcha） |
| `packages/server/src/auth/auth.service.ts` | 认证核心服务（登录、注册、刷新、登出） |
| `packages/server/src/auth/controllers/web-auth.controller.ts` | Web 端认证端点（/web/auth/login/register/refresh/logout） |
| `packages/server/src/auth/controllers/admin-auth.controller.ts` | Admin 端认证端点（/admin/auth/login/refresh/logout） |
| `packages/server/src/auth/strategies/jwt.strategy.ts` | JWT 策略（路径感知 Cookie 解析） |
| `packages/server/src/common/guards/app.guard.ts` | App 隔离守卫（路径分类 + token.app 校验） |
| `packages/server/src/common/decorators/public.decorator.ts` | 公开端点装饰器 |
| `packages/server/src/common/utils/api-path.ts` | 路径工具函数（分类、判断、构建） |
| `packages/server/src/auth/cookie.helper.ts` | Cookie 工具函数（按 app 隔离名称） |
| `packages/server/src/auth/auth-redis.service.ts` | Auth Redis 服务（黑名单、缓存） |
| `packages/server/src/auth/repositories/auth.repository.ts` | Auth 数据访问层 |
| `packages/server/src/modules/admin/seeders/permission.seeder.ts` | 权限初始化 Seeder |
| `packages/server/src/modules/admin/services/permission.service.ts` | 权限服务 |
| `packages/server/src/modules/admin/services/admin.service.ts` | 管理员服务（用户管理、密码重置） |

## 8. Implementation Notes

### 8.1 路径隔离模式

**设计决策**：路径分类优于装饰器

系统采用路径前缀自动分类，无需为每个端点添加 `@AllowApp()` 装饰器：
- `/admin/*` → admin-only，要求 token.app === 'admin'
- `/web/*` → web-biz，要求 token.app === 'web'
- `/auth/me`、`/user/*`、`/settings/*` → common，允许双 app
- `/auth/public-key`、`/auth/captcha`、`/web/auth/login`、`/admin/auth/login`、`/web/auth/register` → public，无需认证

**实现要点**：
- 使用 `categorizePath()` 函数进行路径分类
- 使用 `isAdminOnlyPath()`、`isWebOnlyPath()`、`isPublicPath()` 进行路径判断
- 仅使用 `@Public()` 装饰器标记特殊公开端点

### 8.2 Cookie 按 app 隔离

**设计决策**：Cookie 名称隔离而非子域隔离

web 端和 admin 端使用不同的 Cookie 名称，防止互相覆盖：
- Web: `goferbot_web_access_token` / `goferbot_web_refresh_token`
- Admin: `goferbot_admin_access_token` / `goferbot_admin_refresh_token`

**实现要点**：
- 使用 `cookie.helper.ts` 中定义的常量，禁止硬编码 Cookie 名称
- `setAuthCookies()` 和 `clearAuthCookies()` 接收 `app` 参数
- JwtStrategy 根据路径从正确的 Cookie 名称中提取 token

### 8.3 JwtStrategy 路径感知解析

**设计决策**：通用路径双 Cookie 尝试 + X-App-Context 优先级

通用路径（如 `/auth/me`）需要支持双 app 访问，同域下两个 Cookie 可能同时存在：
- Admin 专属路径 → 只读 admin Cookie
- Web 专属路径 → 只读 web Cookie
- 通用路径 → 根据 `X-App-Context` 请求头决定优先级

**实现要点**：
- `X-App-Context: admin` → 先尝试 admin Cookie，再尝试 web Cookie
- `X-App-Context: web` 或无该头 → 先尝试 web Cookie，再尝试 admin Cookie
- AppGuard 最终校验 token.app 与路径要求匹配

### 8.4 RBAC 角色权限模型

**设计决策**：Role 表 + UserRole 关联表，删除 User.role 字段

角色判断统一走 UserRole 关联表：
- super_admin: 拥有通配符 `*` 权限，所有权限检查直接返回 true
- admin: 拥有全部管理权限码
- user: web 端基础角色，无权限

**实现要点**：
- 超级管理员判定：检查 roles 数组包含 `super_admin`，禁止使用权限数量判断
- 权限查询按 app 过滤：web 仅查询 app='web' 的角色
- 权限缓存 key: `auth:permission:{userId}:{app}`，TTL=300s
- 角色变更后调用 `invalidateUserPermissions()` 清除缓存

### 8.5 PermissionSeeder 幂等初始化

**设计决策**：OnModuleInit 自动 seed，使用 upsert 保证幂等性

**实现要点**：
- 使用 Prisma `upsert` 创建预置角色，保证重启不重复创建
- 系统角色标记 `isSystem=true`，不可通过 API 删除
- 新增权限码自动补充到 super_admin 角色

### 8.6 前端认证初始化

**设计决策**：/auth/me 为唯一信任源，localStorage 仅作为 hydration 缓存

**实现要点**：
- `waitForAuthInit()` 使用 single-flight Promise 防止并发请求
- 401 触发 token refresh（single-flight），403 不触发 refresh
- localStorage 不持久化 `isAuthenticated`，仅缓存 `user` 对象

## 9. Testing Checklist

### 9.1 认证流程测试

- [ ] Web 登录/登出流程正常
- [ ] Admin 登录/登出流程正常
- [ ] Token 刷新流程正常（2h access token、7d refresh token）
- [ ] Token 重放检测正常（并发使用同一 refresh token 触发 TOKEN_REPLAY）
- [ ] /auth/me 返回正确的 roles 和 permissions 数组
- [ ] /auth/me 不接受外部 app 参数

### 9.2 App 隔离测试

- [ ] Web token 访问 /admin/* 返回 403 APP_MISMATCH
- [ ] Admin token 访问 /web/* 返回 403 APP_MISMATCH
- [ ] 双端同时登录互不影响
- [ ] 登出一端不影响另一端的登录状态

### 9.3 Cookie 安全测试

- [ ] Cookie 名称按 app 隔离（web/admin 不同名称）
- [ ] 生产环境 Cookie 安全属性（httpOnly=true, secure=true, sameSite=strict）
- [ ] 开发环境 Cookie 兼容属性（secure=false, sameSite=lax）

### 9.4 RBAC 权限测试

- [ ] super_admin 角色拥有所有权限（通配符 `*`）
- [ ] admin 角色拥有全部管理权限码
- [ ] user 角色无权限
- [ ] 权限缓存生效（5 分钟 TTL）
- [ ] 角色变更后权限缓存立即失效

### 9.5 邀请码测试

- [ ] 标准邀请码一码一账户
- [ ] 测试邀请码多人复用（数据库 type=test）
- [ ] 环境变量测试邀请码正常使用
- [ ] 无效邀请码返回 INVITATION_CODE_INVALID
- [ ] 已使用标准邀请码返回 INVITATION_CODE_USED
- [ ] 过期邀请码返回 INVITATION_CODE_EXPIRED
- [ ] 测试邀请码达到上限返回 INVITATION_CODE_MAX_USES

### 9.6 管理员操作测试

- [ ] 创建用户（含角色分配）
- [ ] 重置管理员密码（仅超管可操作）
- [ ] 禁用/启用用户（不能禁用最后一个 super_admin）
- [ ] 角色 CRUD（系统角色不可删除）
- [ ] 审计日志记录管理员操作

### 9.7 错误码测试

- [ ] APP_MISMATCH（403）
- [ ] SYSTEM_ROLE_DELETE_DENIED（400）
- [ ] SUPER_ADMIN_PROTECTED（400）
- [ ] INVITATION_CODE_INVALID/USED/EXPIRED/MAX_USES（400）

## 10. Common Pitfalls

### 10.1 Cookie 名称硬编码

**问题**：直接在代码中硬编码 Cookie 名称，导致修改时遗漏。

**解决方案**：使用 `cookie.helper.ts` 中定义的常量。

```typescript
// Bad
response.cookie('goferbot_web_access_token', token, options)

// Good
response.cookie(WEB_ACCESS_COOKIE, token, options)
```

### 10.2 路径判断硬编码

**问题**：直接判断路径前缀，导致逻辑不一致。

**解决方案**：使用 `api-path.ts` 中的路径工具函数。

```typescript
// Bad
if (path.startsWith('/admin/')) { ... }

// Good
if (isAdminOnlyPath(path)) { ... }
```

### 10.3 超级管理员权限数量判断

**问题**：使用 `permissions.length >= 20` 作为 super_admin 判定条件。

**解决方案**：检查 roles 数组包含 `super_admin`。

```typescript
// Bad
isSuperAdmin = permissions.length >= 20

// Good
isSuperAdmin = roles.includes('super_admin')
```

### 10.4 前端依赖 localStorage isAuthenticated

**问题**：仅依赖 localStorage 中持久化的 `isAuthenticated` 标记判定登录状态。

**解决方案**：每次初始化调用 `/auth/me` 验证 Cookie 有效性。

### 10.5 403 触发 Token 刷新

**问题**：前端拦截器对 403 错误也触发 token refresh。

**解决方案**：仅 401 触发 refresh，403 直接按权限不足处理。

### 10.6 邀请码字符包含易混淆字符

**问题**：生成的邀请码包含 0/O/1/I/L 等易混淆字符。

**解决方案**：排除这些字符，使用 `GF-XXXX-XXXX` 格式。

### 10.7 PermissionSeeder 与 Bootstrap 顺序竞争

**问题**：SuperAdminBootstrap 在 PermissionSeeder 之前执行，导致角色不存在。

**解决方案**：Seeder 使用 `OnModuleInit`，Bootstrap 使用 `OnApplicationBootstrap`（晚于 OnModuleInit）。

### 10.8 通用路径固定优先读取 web Cookie

**问题**：管理员在 admin 后台访问 `/auth/me` 时只有 admin Cookie 有效，但代码固定优先读 web Cookie。

**解决方案**：根据 `X-App-Context` 请求头决定优先级，双 Cookie 尝试。

### 10.9 删除 User.role 字段后引用残留

**问题**：全局搜索不彻底，仍有代码引用已删除的 User.role 字段。

**解决方案**：全局搜索 `User\.role` 和 `.role`，确保零残留。

### 10.10 未使用的装饰器和代码

**问题**：遗留 `@AllowApp('both')` 装饰器和 `modeToCategory` 方法。

**解决方案**：定期清理未使用的代码，遵循"未使用的代码就是噪声"原则。