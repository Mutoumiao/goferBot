# Auth - 认证与授权

## Purpose（目的）

定义 GoferBot 用户认证、会话管理、权限控制的系统级规范。覆盖 Web 端（主前端）、Admin 端（管理后台）的认证流程、JWT 令牌生命周期（含 Rotation 与重放检测）、RBAC 角色权限模型（基于 Role + UserRole 多角色支持）、CAPTCHA 验证、Cookie 安全策略（按 app 隔离 Cookie 名称）。

## Requirements（需求）

### Requirement: 基于 JWT 双密钥的认证
系统应通过在凭据验证后颁发双 JWT（access token + refresh token）对用户进行认证，两种 token 使用独立密钥签名。

证据来源：
- `packages/server/src/auth/auth.service.ts` (login/register/refresh flow)
- `packages/server/src/auth/auth.controller.ts` (auth endpoints)
- `packages/server/src/auth/strategies/jwt.strategy.ts` (JWT validation)

#### Scenario: Web 用户登录
- **WHEN** Web 用户（GoferBot 主应用）提交有效的用户名 + 密码 + CAPTCHA 时
- **THEN** 系统通过 HTTP-only Cookie 返回 access token（短期 2h，Cookie maxAge 15min）和 refresh token（长期 7d，Cookie maxAge 7d）

#### Scenario: 管理员用户登录
- **WHEN** 管理员用户（管理控制台）提交具有 admin 角色的有效用户名 + 密码时
- **THEN** 系统返回管理员范围的 access token，且端点应拒绝非管理员用户

#### Scenario: 无效凭据
- **WHEN** 用户提交错误的用户名或密码时
- **THEN** 系统返回 401 Unauthorized 及通用错误消息（不泄露用户是否存在）

#### Scenario: 独立密钥签名
- **WHEN** 系统签发 access token 和 refresh token 时
- **THEN** Access Token 使用 `JWT_SECRET` 签发，Refresh Token 使用 `JWT_REFRESH_SECRET` 签发，SHALL 确保两个密钥不同以防止跨类型签名攻击

### Requirement: Token Rotation 与重放检测
系统应通过原子数据库操作实现 Refresh Token 轮换，SHALL 检测并撤销重放攻击中的 Token。

证据来源：
- `packages/server/src/auth/auth.service.ts#L112-L229` (refresh flow)
- `packages/server/src/auth/repositories/auth.repository.ts#L98-L110` (atomic markRefreshTokenUsed)

#### Scenario: 正常 Token 刷新
- **WHEN** 请求携带过期的 access token 但有效的 refresh token 到达时
- **THEN** 系统验证 RefreshToken → 查找其 jtiHash → 三重检查（usedAt 为空 / revokedAt 为空 / 关联 Session 未撤销）→ 生成新 jti → 插入新 RefreshToken → 原子标记旧 Token 已使用（`UPDATE...WHERE usedAt IS NULL AND revokedAt IS NULL RETURNING id`）→ 签发新 Access Token + Refresh Token

#### Scenario: Token 重放检测
- **WHEN** 同一 Refresh Token 被并发请求使用
- **THEN** 只有一个请求的原子 UPDATE 能成功（`RETURNING` 返回行），其余请求检测到 `usedAt` 已设置 → 触发 `TOKEN_REPLAY` 错误码 → 整个关联 Session 被撤销 → 所有活跃 Token 失效

#### Scenario: Refresh token 已撤销
- **WHEN** refresh token 已被撤销（例如用户登出）
- **THEN** 系统返回 401（`TOKEN_REVOKED`），客户端应重定向到登录页面

### Requirement: jti 哈希安全
系统 SHALL 对 Refresh Token 的 jti（JWT ID）进行 SHA256 哈希后存储，MUST NOT 在数据库中存储明文 jti。

证据来源：
- `packages/server/src/auth/auth.service.ts#L344-L350`

#### Scenario: jti 哈希存储
- **WHEN** 系统创建新的 Refresh Token 时
- **THEN** 系统生成 UUID 作为 jti → 写入 JWT payload（明文）→ SHA256 哈希 jti → 存储到 `RefreshToken.jtiHash` 列；数据库泄露时攻击者无法从 jtiHash 反推明文 jti，无法构造有效的 RefreshToken

#### Scenario: Token 验证时 jti 匹配
- **WHEN** 系统验证 Refresh Token 时
- **THEN** 系统从 JWT payload 提取明文 jti → SHA256 哈希 → 与数据库 `jtiHash` 列比较 → 匹配则通过

### Requirement: Token 链式审计追踪
系统 SHALL 在 RefreshToken 表中维护 `parentTokenId`（上一个 Token ID）和 `replacedByTokenId`（替代者 Token ID）外键，形成完整的 Token 旋转链。

证据来源：
- `packages/server/src/auth/repositories/auth.repository.ts#L81-L89`
- `packages/server/src/auth/repositories/auth.repository.ts#L98-L110`

#### Scenario: Token 链完整记录
- **WHEN** Token 刷新成功时
- **THEN** 新创建的 RefreshToken 的 `parentTokenId` 指向旧的 RefreshToken ID，旧的 RefreshToken 的 `replacedByTokenId` 被原子更新为新 Token ID

#### Scenario: 安全审计查询
- **WHEN** 安全事件需要追踪 Token 流转历史时
- **THEN** 系统可通过 `parentTokenId` / `replacedByTokenId` 递归查询完整的 Token 旋转链

### Requirement: CAPTCHA 验证
系统应对登录和注册端点要求 CAPTCHA 验证，SHALL 使用自定义 SVG + PNG 渲染的图文验证码，MUST 支持一次性消费防止暴力探测。

证据来源：
- `packages/server/src/auth/captcha.controller.ts`
- `packages/server/src/auth/captcha.service.ts`

#### Scenario: 验证码生成
- **WHEN** 客户端请求 CAPTCHA 时
- **THEN** 系统生成 4 位随机字符（排除 0/O/1/I 易混淆字符）→ 渲染 SVG（4 条贝塞尔干扰线 + 20 个噪点）→ sharp 转 PNG buffer → 返回图片；验证码答案存储到 Redis `captcha:{id}`，TTL=120s

#### Scenario: 登录需要 CAPTCHA
- **WHEN** 用户尝试登录时
- **THEN** 登录端点 SHALL 在凭据验证之前验证 CAPTCHA token

#### Scenario: 注册需要 CAPTCHA
- **WHEN** 用户尝试注册新账户时
- **THEN** 注册端点 SHALL 在处理之前验证 CAPTCHA token

#### Scenario: 一次性消费防止暴力探测
- **WHEN** 客户端提交 CAPTCHA 验证时（无论正确或错误）
- **THEN** 系统立即删除 Redis 中的验证码记录，每次验证请求必须重新获取新的验证码

#### Scenario: Origin 白名单跳过验证码（开发/测试环境专用）
- **WHEN** `CAPTCHA_ENABLED=true` 且请求 Origin 在 `CAPTCHA_WHITELIST_ORIGINS` 白名单中（非生产环境）
- **THEN** 系统跳过 CAPTCHA 验证，允许请求继续处理
- **WHEN** `NODE_ENV=production`
- **THEN** 白名单配置被忽略，强制执行 CAPTCHA 验证
- **WHEN** `CAPTCHA_ENABLED=false`（默认）
- **THEN** 系统跳过 CAPTCHA 验证，允许请求继续处理

### Requirement: RBAC 权限模型
系统应强制执行基于角色的访问控制，通过 Role 表和 UserRole 关联表实现多角色支持，MUST NOT 使用 User.role 字段（已删除）。角色 SHALL 使用小写 snake_case 编码，预置角色为 `super_admin`、`admin`、`user`。超级管理员判定 SHALL 检查用户角色列表是否包含 `super_admin` roleCode，MUST NOT 使用权限数量判断。

证据来源：
- `packages/server/prisma/schema.prisma` (Role, UserRole 模型)
- `packages/server/src/modules/admin/services/permission.service.ts`
- `packages/server/src/auth/guards/permission.guard.ts`

#### Scenario: 普通用户被拒绝访问管理员端点
- **WHEN** 仅具有 `user` 角色的用户访问受管理员权限保护的端点时
- **THEN** 系统返回 403 Forbidden

#### Scenario: 基于权限的访问控制
- **WHEN** 用户访问带有 `@Permission('users:read')` 装饰器的端点时
- **THEN** 系统 SHALL 通过 PermissionService.hasAnyPermission() 验证用户是否拥有该权限（通过 Role→RolePermission 关联查询）

#### Scenario: SUPER_ADMIN 权限豁免
- **WHEN** 用户具有 `super_admin` 角色时（UserRole 关联中 roleCode = 'super_admin'）
- **THEN** 所有权限检查直接返回 true，无需逐个校验权限码

#### Scenario: 多角色权限合并
- **WHEN** 用户同时拥有多个角色时
- **THEN** 系统 SHALL 合并所有角色的权限码集合，去重后作为用户的有效权限集

#### Scenario: 权限缓存
- **WHEN** PermissionService 查询用户权限时
- **THEN** 优先从 Redis `auth:permission:{userId}:{app}` 缓存读取（TTL=300s）；miss 时查询 Role→RolePermission 表并写入缓存

#### Scenario: 权限缓存失效
- **WHEN** 用户角色分配发生变更时
- **THEN** 系统调用 `invalidateUserPermissions(userId, app)` 清除特定用户特定 app 的权限缓存

#### Scenario: 角色与 app 绑定
- **WHEN** 查询用户权限时
- **THEN** 系统 SHALL 按 app 过滤角色：web app 仅查询 app='web' 的角色，admin app 仅查询 app='admin' 的角色

### Requirement: 令牌黑名单与 Redis Fail-Closed
系统应将已撤销的 Access Token 写入 Redis 黑名单，SHALL 在 Redis 不可用时执行 Fail-Closed 策略。

证据来源：
- `packages/server/src/auth/auth-redis.service.ts#L61-L85`

#### Scenario: Token 黑名单写入
- **WHEN** 用户登出或 Token 被撤销
- **THEN** 系统将 Access Token 写入 Redis 黑名单（key 前缀 `token:blacklist:`），TTL 与 token 剩余有效期一致

#### Scenario: JwtAuthGuard 黑名单检查
- **WHEN** 请求携带 Access Token 时
- **THEN** JwtAuthGuard 先检查 Redis 黑名单 → 若在黑名单中则直接返回 401 → 否则交给 Passport JwtStrategy.validate() 验证

#### Scenario: Redis 不可用 — Fail-Closed（生产环境）
- **WHEN** 生产环境中 Auth Redis 不可用时
- **THEN** `isTokenBlacklisted()` 返回 `true`，系统拒绝所有携带 Token 的请求（拒绝优于放过），所有端点返回 401

#### Scenario: Redis 不可用 — 降级（开发环境）
- **WHEN** 开发环境中 Auth Redis 不可用时
- **THEN** 系统降级允许所有请求通过（`isFailClosed` 返回 false），保证本地开发体验

### Requirement: 密码安全
系统应使用 bcrypt 对密码进行哈希（最小成本因子为 10），并强制执行最小密码强度规则。

证据来源：
- `packages/server/src/auth/dto/password.schema.ts`
- `packages/server/src/auth/auth.service.ts`

#### Scenario: 密码强度验证
- **WHEN** 用户设置的密码短于 8 个字符或没有混合字符类型时
- **THEN** 系统返回验证错误

#### Scenario: 密码更改
- **WHEN** 已认证用户更改密码时
- **THEN** 系统应要求提供当前密码，验证它，哈希新密码，并使所有现有会话无效

#### Scenario: 密码更改撤销所有会话
- **WHEN** 用户密码变更成功时
- **THEN** 系统 SHALL 在事务中撤销该用户所有 AuthSession 和 RefreshToken（`revokedAt` 设置为当前时间）

### Requirement: 会话管理
系统应跟踪活跃用户会话，并支持强制会话失效和用户级批量撤销。

证据来源：
- `packages/server/src/auth/auth.service.ts` (logout/revoke flow)
- `packages/server/src/auth/auth-redis.service.ts`
- `packages/server/src/auth/repositories/auth.repository.ts`

#### Scenario: 用户登出
- **WHEN** 用户明确登出时
- **THEN** 系统撤销当前的 Refresh Token（`revokedAt` 设置）、将 Access Token 写入 Redis 黑名单、清除认证 Cookie

#### Scenario: 管理员强制登出
- **WHEN** 管理员撤销用户的会话时
- **THEN** 系统调用 `revokeAllSessionsForUser`，在事务中撤销该用户的所有 AuthSession + RefreshToken

#### Scenario: Token 重放导致全会话撤销
- **WHEN** 检测到 `TOKEN_REPLAY` 时
- **THEN** 系统撤销关联的整个 AuthSession（`revokedAt` 设置），该 Session 下所有 RefreshToken 全部失效

### Requirement: Cookie 安全策略
系统 SHALL 在认证 Cookie 上强制执行严格的安全属性，按 app 隔离 Cookie 名称防止 web/admin 互相覆盖。

证据来源：
- `packages/server/src/auth/cookie.helper.ts`

#### Scenario: 生产环境 Web 端 Cookie
- **WHEN** 在生产环境中为 web 端设置认证 Cookie 时
- **THEN** Access Token Cookie 名称为 `goferbot_web_access_token`（maxAge=15min, httpOnly=true, secure=true, sameSite=strict, path=/），Refresh Token Cookie 名称为 `goferbot_web_refresh_token`（maxAge=7d, 其余属性相同）

#### Scenario: 生产环境 Admin 端 Cookie
- **WHEN** 在生产环境中为 admin 端设置认证 Cookie 时
- **THEN** Access Token Cookie 名称为 `goferbot_admin_access_token`（maxAge=15min, httpOnly=true, secure=true, sameSite=strict, path=/），Refresh Token Cookie 名称为 `goferbot_admin_refresh_token`（maxAge=7d, 其余属性相同）

#### Scenario: 开发环境 Cookie 兼容性
- **WHEN** 在开发环境中设置认证 Cookie 时
- **THEN** secure=false, sameSite=lax（兼容 localhost 和不同端口），Cookie 名称仍按 app 区分，其余属性与生产环境一致

#### Scenario: Cookie 清除按 app 隔离
- **WHEN** 用户登出时
- **THEN** 系统仅清除当前 app 对应的两个 Cookie，MUST NOT 清除另一 app 的 Cookie

### Requirement: 认证错误码体系
系统 SHALL 为所有认证错误定义明确的错误码，用于前端统一错误处理和用户体验。

证据来源：
- `packages/server/src/auth/errors.ts`

#### Scenario: 标准错误码返回
- **WHEN** 认证流程中发生错误时
- **THEN** 系统返回结构化错误响应 `{ success: false, error: { code, message } }`：

| 错误码                     | HTTP | 触发条件                                 |
|----------------------------|------|------------------------------------------|
| `AUTH_INVALID_CREDENTIALS` | 401  | 邮箱或密码错误                           |
| `ACCOUNT_DISABLED`         | 403  | 账号已被管理员禁用                       |
| `NO_ADMIN_ROLE`            | 403  | 非管理员尝试访问管理后台                 |
| `INVALID_TOKEN_TYPE`       | 401  | JWT payload type 字段不正确              |
| `TOKEN_NOT_FOUND`          | 401  | RefreshToken jtiHash 在数据库中不存在    |
| `TOKEN_REPLAY`             | 401  | 同一 RefreshToken 被重复使用（重放攻击） |
| `TOKEN_REVOKED`            | 401  | RefreshToken 已被主动撤销                |
| `SESSION_REVOKED`          | 401  | 关联 AuthSession 已被撤销                |
| `USER_NOT_FOUND`           | 401  | JWT payload 中的 userId 在数据库中不存在 |
| `INVALID_REFRESH_TOKEN`    | 401  | RefreshToken 无效或已过期                |
| `CAPTCHA_REQUIRED`         | 400  | 请求缺少验证码                           |
| `CAPTCHA_INVALID`          | 400  | 验证码错误或已过期                       |
| `APP_MISMATCH`             | 403  | token.app 与端点要求的 app 不匹配        |
| `INVITATION_CODE_INVALID`  | 400  | 邀请码不存在                             |
| `INVITATION_CODE_USED`     | 400  | 标准邀请码已被使用                       |
| `INVITATION_CODE_EXPIRED`  | 400  | 邀请码已过期                             |
| `INVITATION_CODE_MAX_USES` | 400  | 测试邀请码达到使用上限                   |
| `SYSTEM_ROLE_DELETE_DENIED`| 400  | 尝试删除系统预置角色                     |
| `SUPER_ADMIN_PROTECTED`    | 400  | 尝试禁用/删除最后一个 super_admin        |

### Requirement: Auth Redis 独立连接
系统 SHALL 为认证模块维护独立的 Redis 连接，MUST NOT 与 Queue（BullMQ）或 Cache（CacheService）共享 Redis 连接。

证据来源：
- `packages/server/src/auth/auth-redis.service.ts#L16`

#### Scenario: 独立 Redis 连接创建
- **WHEN** AuthRedisService 初始化时
- **THEN** 系统通过 `createRedisConnection()` 创建独立连接，使用 Queue Redis 的环境变量配置（`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`）

#### Scenario: 队列拥塞不影响认证
- **WHEN** BullMQ 队列因大量任务导致 Redis 连接池耗尽时
- **THEN** Auth Redis 独立连接不受影响，用户仍可正常登录和鉴权

#### Scenario: 用户缓存与权限缓存逐出
- **WHEN** 用户信息或权限被缓存在 Auth Redis 中时
- **THEN** 缓存 TTL 为 300s（5 分钟）；用户信息缓存 key 前缀为 `auth:user:`，权限缓存 key 前缀为 `auth:permission:`

### Requirement: 并发 Token 刷新幂等性
客户端 SHALL 保证并发 401 请求只触发一次 Token 刷新，所有等待中的请求共享同一次刷新结果，MUST 避免多次刷新导致的 Token 链断裂或竞态条件。

证据来源：
- `packages/admin/src/utils/server.ts` (alova responded 拦截器)
- `packages/web/src/utils/auth.ts` (Token 刷新逻辑)

#### Scenario: 批量请求只触发一次刷新
- **WHEN** 多个并发请求同时收到 401 响应时
- **THEN** 系统 MUST 仅触发一次 Token 刷新操作，所有并发请求共享同一次刷新结果并在刷新完成后自动重试，MUST NOT 出现多次并发刷新导致的 Token 链断裂或竞态条件

#### Scenario: 刷新失败通知所有等待者
- **WHEN** Token 刷新操作失败时
- **THEN** 系统 SHALL 将失败状态通知所有等待中的请求，MUST 触发统一的登出或错误处理流程，避免部分请求卡住

### Requirement: App 隔离守卫
系统 SHALL 通过路径分类工具函数和 `AppGuard`，校验 JWT payload 中的 `app` 字段与请求端点期望的 app 是否匹配，防止跨 app token 滥用。公开端点使用 `@Public()` 装饰器标记。

证据来源：
- `packages/server/src/common/decorators/public.decorator.ts`
- `packages/server/src/common/guards/app.guard.ts`
- `packages/server/src/common/utils/api-path.ts`

#### Scenario: Admin 专属路径自动判定
- **WHEN** 请求路径以 `/admin` 开头时
- **THEN** 系统自动要求 `token.app === 'admin'`

#### Scenario: Web Auth 专属端点
- **WHEN** 请求路径为 `/web/auth/refresh` 或 `/web/auth/logout` 时
- **THEN** 系统自动要求 `token.app === 'web'`

#### Scenario: Admin Auth 专属端点
- **WHEN** 请求路径为 `/admin/auth/refresh` 或 `/admin/auth/logout` 时
- **THEN** 系统自动要求 `token.app === 'admin'`

#### Scenario: Web 业务专属路径
- **WHEN** 请求路径以 `/web` 开头时（不含 `/web/auth/*` 公开端点）
- **THEN** 系统自动要求 `token.app === 'web'`

#### Scenario: 通用端点允许双 app
- **WHEN** 请求路径为 `/auth/me` 或以 `/user/`、`/settings/`、`/chat/`、`/session/`、`/knowledge-base/`、`/companion/` 开头且不以 `/admin/`、`/web/` 开头时
- **THEN** 系统允许 `token.app` 为 `'web'` 或 `'admin'` 任一值通过

#### Scenario: 公开端点无需认证
- **WHEN** 请求路径为 `/web/auth/login`、`/admin/auth/login`、`/web/auth/register`、`/auth/public-key`、`/auth/captcha` 时
- **THEN** 系统 MUST NOT 要求认证，AppGuard 在无 request.user 时直接放行

#### Scenario: 公开端点标记
- **WHEN** Controller 或方法上使用 `@Public()` 装饰器时
- **THEN** 系统将该端点标记为公开，无需认证即可访问

#### Scenario: App 不匹配拒绝访问
- **WHEN** token.app 与端点要求的 app 不匹配时
- **THEN** 系统返回 403 Forbidden，错误码 `APP_MISMATCH`

#### Scenario: JwtStrategy 路径感知解析
- **WHEN** JwtStrategy 验证 token 时
- **THEN** 系统 SHALL 根据请求路径从正确的 Cookie 名称中提取 token：
  - Admin 专属路径（`/admin/*`）→ 从 `goferbot_admin_access_token` 读取
  - Web 专属路径（`/web/*`）→ 从 `goferbot_web_access_token` 读取
  - 通用路径（`/auth/me`、`/user/*`、`/settings/*`、`/chat/*`、`/session/*`、`/knowledge-base/*`、`/companion/*`）→ 同域下两个 Cookie 可能同时存在，根据请求头 `X-App-Context` 决定读取优先级：`X-App-Context: admin` 先尝试 admin Cookie 再 web，`X-App-Context: web` 或无该头时先尝试 web Cookie 再 admin，取首个验证通过的 token（由 AppGuard 最终校验 app 匹配）
  - 公开路径（`/auth/public-key`、`/auth/captcha`、`/web/auth/login`、`/admin/auth/login`、`/web/auth/register`）→ 不读取 Cookie（无认证要求）

#### Scenario: 前端自动添加 X-App-Context 请求头
- **WHEN** 前端 API 客户端发起请求时
- **THEN** web 端 alova 实例 MUST 在所有请求中添加 `X-App-Context: web` 请求头，admin 端 alova 实例 MUST 添加 `X-App-Context: admin` 请求头

### Requirement: PermissionSeeder 启动权限初始化
系统 SHALL 在启动时通过 PermissionSeeder 自动 seed 权限定义和预置角色，确保权限数据完整性。

证据来源：
- `packages/server/src/modules/admin/seeders/permission.seeder.ts`

#### Scenario: 首次启动创建权限和角色
- **WHEN** 应用首次启动（数据库中无 Role 记录）时
- **THEN** PermissionSeeder SHALL：(1) 创建所有权限码记录（如存在 PermissionCode 表则插入，否则仅在内存中维护列表），(2) 创建 3 个预置角色：super_admin（admin app，所有权限通过通配符 `*` 分配）、admin（admin app，分配全部管理权限码）、user（web app，无权限），(3) 为预置角色分配对应权限集合，(4) 所有预置角色标记 isSystem=true

#### Scenario: 幂等 seed
- **WHEN** 应用重启时
- **THEN** PermissionSeeder SHALL 检查预置角色是否已存在，存在则跳过创建；如发现新增权限码，将权限码补充到 super_admin 角色中但 MUST NOT 修改 admin/user 角色的已有权限

#### Scenario: 系统角色不可删除
- **WHEN** 管理员尝试删除 isSystem=true 的预置角色时
- **THEN** 系统返回 400 错误，错误码 `SYSTEM_ROLE_DELETE_DENIED`

### Requirement: 前端认证初始化安全
前端 SHALL 在应用初始化时通过调用 `/auth/me` 端点验证 Cookie 中 token 的有效性，MUST NOT 仅依赖 localStorage 中持久化的 `isAuthenticated` 标记判定登录状态。

证据来源：
- `packages/admin/src/stores/auth.ts`
- `packages/admin/src/utils/auth-guard.ts`
- `packages/web/src/stores/auth.ts`

#### Scenario: 页面加载时验证认证状态
- **WHEN** 前端应用初始化（beforeLoad 路由守卫）时
- **THEN** 系统 SHALL 发起单次 `/auth/me` 请求（single-flight，并发请求共享同一 Promise）：成功则将用户信息（含 roles 数组）写入 store，失败（401）则清除 store 并重定向到登录页

#### Scenario: localStorage 仅作为 hydration 缓存
- **WHEN** Zustand auth store 持久化到 localStorage 时
- **THEN** MUST NOT 持久化 `isAuthenticated` 作为信任标记；MAY 持久化 `user` 对象用于 hydration 时避免 UI 闪烁，但 MUST 在 `waitForAuthInit` 中通过 `/auth/me` 响应覆盖 localStorage 缓存数据，真正认证状态以 `/auth/me` 返回结果为唯一信任源

#### Scenario: waitForAuthInit 超时保护
- **WHEN** `/auth/me` 请求在 3 秒内未响应时
- **THEN** 系统 SHALL 判定为未认证状态，重定向到登录页，MUST NOT 永久白屏

#### Scenario: 401 触发 Token 刷新
- **WHEN** API 请求返回 401 时
- **THEN** 前端拦截器 SHALL 触发单次 refresh 请求（single-flight），所有并发 401 请求共享同一刷新结果，刷新成功后重试原请求

#### Scenario: 403 不触发刷新
- **WHEN** API 请求返回 403 时
- **THEN** 前端拦截器 SHALL NOT 触发 token refresh，直接按权限不足处理（重定向到 /forbidden 或显示无权限提示）

### Requirement: 认证模块边界清理
auth 模块 SHALL 仅负责纯认证逻辑（登录、注册、登出、refresh、me），MUST NOT 包含个人资料管理、头像上传等非认证功能。

证据来源：
- `packages/server/src/auth/auth.controller.ts`
- `packages/server/src/modules/user/user.controller.ts`

#### Scenario: 个人资料接口迁出 auth
- **WHEN** 用户需要更新个人资料（name等）时
- **THEN** 请求 PATCH `/user/me` 端点（位于 user 模块），MUST NOT 使用 auth 模块的接口

#### Scenario: 头像上传接口迁出 auth
- **WHEN** 用户需要上传头像时
- **THEN** 请求 POST `/user/avatar` 端点（位于 user 模块），MUST NOT 使用 auth 模块的接口

#### Scenario: Web 注册路径
- **WHEN** Web 用户注册时
- **THEN** 请求 POST `/web/auth/register` 端点，必须携带邀请码

#### Scenario: Web/Admin Logout 路径分离
- **WHEN** Web 用户登出时请求 POST `/web/auth/logout`，Admin 用户登出时请求 POST `/admin/auth/logout`
- **THEN** 系统清除对应 app 的 Cookie，MUST NOT 影响另一 app 的登录状态

#### Scenario: /auth/me 不接受外部 app 参数
- **WHEN** 客户端请求 GET `/auth/me` 时
- **THEN** 系统 MUST 从 JWT payload 中获取 app 信息，MUST NOT 接受客户端传入的 app 参数（防止客户端伪造 app 上下文）

#### Scenario: Legacy 接口删除
- **WHEN** 请求访问已删除的 legacy 端点 `/auth/login` 或 `/auth/refresh` 时
- **THEN** 系统返回 404 Not Found（这些端点已被 app 专属端点替代：`/web/auth/login`、`/admin/auth/login`、`/web/auth/refresh`、`/admin/auth/refresh`）
