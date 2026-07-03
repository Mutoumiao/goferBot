# Auth - 认证与授权

## Purpose（目的）

定义 GoferBot 用户认证、会话管理、权限控制的系统级规范。覆盖 Web 端（主前端）、Admin 端（管理后台）的认证流程、JWT 令牌生命周期（含 Rotation 与重放检测）、RBAC 角色权限模型（含 SUPER_ADMIN 判定）、CAPTCHA 验证、Cookie 安全策略。

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

### Requirement: RBAC 权限模型
系统应强制执行基于角色的访问控制，至少包含三个角色：`USER`、`ADMIN`、`SUPER_ADMIN`，并通过三层 Guard 链（JWT → Roles → Permission）实现分层鉴权。

证据来源：
- `packages/server/src/auth/enums/role.enum.ts`
- `packages/server/src/auth/guards/roles.guard.ts`
- `packages/server/src/auth/guards/permission.guard.ts`
- `packages/server/src/auth/services/permission.service.ts`

#### Scenario: 普通用户被拒绝访问管理员端点
- **WHEN** 具有 `USER` 角色的用户访问受 `ADMIN` 保护的端点时
- **THEN** 系统返回 403 Forbidden

#### Scenario: 基于权限的访问控制
- **WHEN** 用户访问带有 `@Permission('users.read')` 装饰器的端点时
- **THEN** 系统 SHALL 通过 PermissionService.hasAnyPermission() 验证用户的权限

#### Scenario: SUPER_ADMIN 权限豁免
- **WHEN** 用户具有 `SUPER_ADMIN` 角色时
- **THEN** 系统判定条件为 `permissions.includes('*')` 或 `permissions.length >= 20` → 所有权限检查直接返回 true

#### Scenario: 权限缓存
- **WHEN** PermissionService 查询用户权限时
- **THEN** 优先从 Redis `auth:permission:{userId}` 缓存读取（TTL=300s）；miss 时查询 RolePermission 表并写入缓存

#### Scenario: 权限缓存失效
- **WHEN** 用户权限发生变更时
- **THEN** 系统调用 `invalidateUserPermissions(userId, app)` 清除特定用户的权限缓存，或 `invalidateAllPermissions()` 清除全部

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
系统 SHALL 在认证 Cookie 上强制执行严格的安全属性，生产和开发环境使用不同的策略。

证据来源：
- `packages/server/src/auth/cookie.helper.ts`

#### Scenario: 生产环境 Cookie 安全
- **WHEN** 在生产环境中设置认证 Cookie 时
- **THEN** Access Token Cookie（`goferbot_access_token`）的 maxAge=15min，Refresh Token Cookie（`goferbot_refresh_token`）的 maxAge=7d；两者均设置 httpOnly=true, secure=true, sameSite=strict, path=/

#### Scenario: 开发环境 Cookie 兼容性
- **WHEN** 在开发环境中设置认证 Cookie 时
- **THEN** secure=false, sameSite=lax（兼容 localhost 和不同端口），其余属性与生产环境一致

### Requirement: 认证错误码体系
系统 SHALL 为所有认证错误定义明确的错误码，用于前端统一错误处理和用户体验。

证据来源：
- `packages/server/src/auth/errors.ts`

#### Scenario: 标准错误码返回
- **WHEN** 认证流程中发生错误时
- **THEN** 系统返回结构化错误响应 `{ success: false, error: { code, message } }`：

| 错误码 | HTTP | 触发条件 |
|--------|------|----------|
| `AUTH_INVALID_CREDENTIALS` | 401 | 邮箱或密码错误 |
| `ACCOUNT_DISABLED` | 403 | 账号已被管理员禁用 |
| `NO_ADMIN_ROLE` | 403 | 非管理员尝试访问管理后台 |
| `INVALID_TOKEN_TYPE` | 401 | JWT payload type 字段不正确 |
| `TOKEN_NOT_FOUND` | 401 | RefreshToken jtiHash 在数据库中不存在 |
| `TOKEN_REPLAY` | 401 | 同一 RefreshToken 被重复使用（重放攻击） |
| `TOKEN_REVOKED` | 401 | RefreshToken 已被主动撤销 |
| `SESSION_REVOKED` | 401 | 关联 AuthSession 已被撤销 |
| `USER_NOT_FOUND` | 401 | JWT payload 中的 userId 在数据库中不存在 |
| `INVALID_REFRESH_TOKEN` | 401 | RefreshToken 无效或已过期 |
| `CAPTCHA_REQUIRED` | 400 | 请求缺少验证码 |
| `CAPTCHA_INVALID` | 400 | 验证码错误或已过期 |

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
