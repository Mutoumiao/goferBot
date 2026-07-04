# User - 用户管理

## Purpose（目的）

定义 GoferBot 用户账户管理、密码安全策略、超级管理员引导流程的系统级规范。与 Auth 模块互补——Auth 负责认证/授权，User 负责账户生命周期管理。

## Requirements（需求）

### Requirement: User Profile Management
系统应支持用户档案操作，包括创建、通过邮箱/ID查询、姓名更新和头像更新。个人资料和头像接口从 auth 模块迁移至 user 模块，通过独立的 user controller 暴露。

证据来源：
- `packages/server/src/modules/user/user.controller.ts` (新增)
- `packages/server/src/modules/user/user.service.ts`

#### Scenario: 通过邮箱查找用户
- **WHEN** 执行通过邮箱查找用户操作
- **THEN** 系统返回用户档案（id、email、name、avatar、isActive、createdAt、updatedAt）或 null，MUST NOT 返回 role 字段（已删除），MUST NOT 返回密码哈希

#### Scenario: 创建用户时检查重复邮箱
- **WHEN** 使用已存在的邮箱创建新用户
- **THEN** 系统应拒绝请求并返回 `EMAIL_EXISTS`（409 Conflict）

#### Scenario: 更新当前用户资料
- **WHEN** 已认证用户通过 PATCH `/user/me` 更新其显示名称
- **THEN** 系统更新对应字段并返回更新后的档案

#### Scenario: 用户自行修改密码
- **WHEN** 已认证用户通过 PATCH `/user/me` 提交当前密码和新密码时
- **THEN** 系统验证当前密码正确后 bcrypt 哈希新密码并保存，密码修改成功后撤销所有其他活跃会话（保留当前会话），MUST NOT 设置 mustChangePassword（该字段已删除）

#### Scenario: 修改密码时当前密码错误
- **WHEN** 用户提交修改密码请求但当前密码验证失败时
- **THEN** 系统返回 400 错误，MUST NOT 更新密码

#### Scenario: 上传头像
- **WHEN** 已认证用户通过 POST `/user/avatar` 上传头像图片
- **THEN** 系统上传文件到 S3 存储，更新用户 avatarKey 字段，返回头像访问 URL

#### Scenario: 获取当前用户信息
- **WHEN** 已认证用户通过 GET `/user/me` 获取自身信息
- **THEN** 返回用户档案及该用户在当前 app 下的角色列表（roles 数组）和权限列表（permissions 数组）

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
当配置了 `SUPER_ADMIN_EMAIL` 和 `SUPER_ADMIN_PASSWORD` 环境变量时，系统应在首次启动时自动引导超级管理员账户，适配新的 Role 表模型。

证据来源：
- `packages/server/src/modules/user/services/super-admin-bootstrap.service.ts`

#### Scenario: 幂等引导
- **WHEN** 服务器启动
- **THEN** 系统检查是否存在拥有 `super_admin` 角色的用户；如果存在，则跳过引导

#### Scenario: 分布式引导锁
- **WHEN** 多个服务器实例并发启动
- **THEN** 系统应使用键为 `super_admin_bootstrapping`（30秒TTL）的分布式锁；检测到锁被其他实例持有的实例应跳过引导

#### Scenario: 完整引导序列（适配新 Role 模型）
- **WHEN** 执行引导
- **THEN** 系统应在单个事务中执行：
  1. 确保 PermissionSeeder 已完成（预置角色存在）
  2. 在事务级别重新检查是否存在 super_admin 用户
  3. 获取分布式锁
  4. 创建 User（SUPER_ADMIN），密码使用 bcrypt 哈希，MUST NOT 设置 mustChangePassword
  5. 创建 UserRole 记录，关联 super_admin 角色（admin app），同时关联 user 角色（web app）
  6. 写入 `super_admin_bootstrapped` 系统标志
  7. 写入审计日志

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
