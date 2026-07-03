# User - 用户管理

## Purpose（目的）

定义 GoferBot 用户账户管理、密码安全策略、超级管理员引导流程的系统级规范。与 Auth 模块互补——Auth 负责认证/授权，User 负责账户生命周期管理。

## Requirements（需求）

### Requirement: User Profile Management
系统应支持用户档案操作，包括创建、通过邮箱/ID查询、姓名更新和头像更新。

证据来源：
- `packages/server/src/modules/user/user.service.ts#L42-L115`

#### Scenario: 通过邮箱查找用户
- **WHEN** 执行通过邮箱查找用户操作
- **THEN** 系统返回用户档案（id、email、name、avatar、role、isActive、mustChangePassword、timestamps）或 null

#### Scenario: 创建用户时检查重复邮箱
- **WHEN** 使用已存在的邮箱创建新用户
- **THEN** 系统应拒绝请求并返回 `EMAIL_EXISTS`（409 Conflict）

#### Scenario: 更新用户名
- **WHEN** 已认证用户更新其显示名称
- **THEN** 系统更新 name 字段并返回更新后的档案

### Requirement: Password Security
系统应强制实施安全的密码管理：bcrypt 哈希、密码修改时验证当前密码、密码修改时撤销所有会话。

证据来源：
- `packages/server/src/modules/user/user.service.ts#L117-L199`

#### Scenario: 密码验证
- **WHEN** 用户提供认证凭据
- **THEN** 系统应将提供的密码与存储的 bcrypt 哈希进行比较，成功时返回用户档案，失败时返回 `AUTH_INVALID_CREDENTIALS`

#### Scenario: 密码修改并撤销会话
- **WHEN** 用户修改密码（提供当前密码）
- **THEN** 系统应在单个事务中执行：(1) 更新密码哈希，(2) 撤销所有认证会话（`revokedAt + revokedReason='password_changed'`），(3) 撤销所有刷新令牌，(4) 发布 `UserPasswordChangedEvent`
- **AND** bcrypt 哈希计算应在事务外执行以缩短锁持有时长

#### Scenario: 强制密码修改（首次登录）
- **WHEN** `mustChangePassword=true` 的用户调用 `updatePasswordForce`
- **THEN** 系统应在事务中更新密码并清除 `mustChangePassword` 标志

#### Scenario: 未授权的密码修改
- **WHEN** 用户尝试修改另一个用户的密码
- **THEN** 系统应拒绝请求并返回 `FORBIDDEN`（403）

### Requirement: User Status Management
系统应支持切换用户激活状态并发送事件通知。

证据来源：
- `packages/server/src/modules/user/user.service.ts#L201-L224`

#### Scenario: 停用用户
- **WHEN** 管理员停用用户（isActive=false）
- **THEN** 系统更新状态并发布包含新旧状态值的 `UserStatusChangedEvent`

#### Scenario: 重新激活用户
- **WHEN** 管理员重新激活用户（isActive=true）
- **THEN** 系统更新状态并发布 `UserStatusChangedEvent`

### Requirement: Super Admin Bootstrap
当配置了 `SUPER_ADMIN_EMAIL` 和 `SUPER_ADMIN_PASSWORD` 环境变量时，系统应在首次启动时自动引导超级管理员账户。

证据来源：
- `packages/server/src/modules/user/services/super-admin-bootstrap.service.ts#L50-L189`

#### Scenario: 幂等引导
- **WHEN** 服务器启动
- **THEN** 系统检查 SUPER_ADMIN 用户是否已存在；如果存在，则跳过引导

#### Scenario: 分布式引导锁
- **WHEN** 多个服务器实例并发启动
- **THEN** 系统应使用键为 `super_admin_bootstrapping`（30秒TTL）的 `systemFlag` 作为分布式锁；检测到锁被其他实例持有的实例应跳过引导

#### Scenario: 完整引导序列
- **WHEN** 执行引导
- **THEN** 系统应在单个事务中执行：(1) upsert Application 记录（admin + web），(2) upsert ApplicationAuthMethod（两个应用的密码认证），(3) 在事务级别重新检查是否存在 SUPER_ADMIN，(4) 获取分布式锁，(5) 创建 User（SUPER_ADMIN），密码使用 bcrypt 哈希且 `mustChangePassword=true`，(6) 创建 UserRole 记录（admin + web 的 OWNER），(7) 写入 `super_admin_bootstrapped` systemFlag，(8) 写入审计日志

#### Scenario: 并发引导竞争解决
- **WHEN** 两个实例竞争创建超级管理员
- **THEN** 失败的实例捕获 Prisma P2002（唯一约束冲突）并记录警告，而非崩溃

#### Scenario: 无引导凭据
- **WHEN** 未配置 `SUPER_ADMIN_EMAIL` 或 `SUPER_ADMIN_PASSWORD`
- **THEN** 系统应记录警告并跳过引导，不报错

### Requirement: Event-Driven Notifications
系统应发布用户生命周期变更的领域事件，以实现跨模块响应。

证据来源：
- `packages/server/src/modules/user/user.service.ts#L192-L199`
- `packages/server/src/modules/user/user.service.ts#L217-L221`

#### Scenario: 密码变更事件
- **WHEN** 用户修改密码
- **THEN** 系统通过 EventEmitter2 发布 `UserPasswordChangedEvent(userId)`，允许其他模块做出响应（例如邮件通知、审计日志）

#### Scenario: 状态变更事件
- **WHEN** 用户的激活状态发生变化
- **THEN** 系统通过 EventEmitter2 发布 `UserStatusChangedEvent(userId, newStatus, oldStatus)`
