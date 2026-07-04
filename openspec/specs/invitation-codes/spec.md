# Invitation Codes - 邀请码管理

## Purpose（目的）

TBD

## Requirements（需求）

### Requirement: Invitation Code 数据模型

系统 SHALL 维护邀请码表用于控制 web 端注册访问，MUST 支持两种类型邀请码：标准邀请码（一码一账户，由管理员在后台生成）和测试邀请码（环境变量注入，多人复用，不入库）。

证据来源：
- `packages/server/prisma/schema.prisma` (InvitationCode 模型)
- `packages/server/src/auth/auth.service.ts` (注册流程)

#### Scenario: 标准邀请码结构
- **WHEN** 管理员在后台生成标准邀请码时
- **THEN** 系统创建 InvitationCode 记录，包含字段：id(uuid)、code(唯一，格式 GF-XXXX-XXXX)、type="standard"、maxUses(null)、usedCount(0)、note(备注)、createdBy(创建者ID)、usedBy(null)、expiresAt(null)、createdAt、updatedAt

#### Scenario: 测试邀请码环境变量注入
- **WHEN** 服务器启动时
- **THEN** 系统从环境变量 `TEST_INVITATION_CODES`（逗号分隔）加载测试邀请码列表，这些邀请码 MUST NOT 写入数据库，admin 后台 MUST NOT 展示或管理

#### Scenario: 邀请码格式
- **WHEN** 系统生成邀请码时
- **THEN** code 格式 SHALL 为 `GF-` + 4位大写字母数字 + `-` + 4位大写字母数字（如 GF-A1B2-C3D4），排除易混淆字符 0/O/1/I/L

### Requirement: Web 端注册必须提供邀请码

系统 SHALL 在 web 端注册端点 `/auth/web/register` 强制要求提供有效的邀请码，MUST NOT 允许无邀请码注册。

证据来源：
- `packages/server/src/auth/auth.controller.ts` (web register endpoint)
- `packages/server/src/auth/auth.service.ts` (register logic)

#### Scenario: 有效标准邀请码注册
- **WHEN** 用户提交注册请求且邀请码匹配数据库中 type=standard 且 usedBy=null 的记录时
- **THEN** 注册成功，系统在同一事务中：(1) 创建 User 记录，(2) 创建 UserRole 记录关联 user 角色，(3) 更新 InvitationCode.usedBy = userId、usedCount = 1，(4) 自动登录签发 token

#### Scenario: 有效测试邀请码注册
- **WHEN** 用户提交注册请求且邀请码匹配 `TEST_INVITATION_CODES` 环境变量中的值时
- **THEN** 注册成功，系统创建 User 和 UserRole 记录，User.invitationCodeId 保持 null（不关联数据库邀请码），自动登录签发 token

#### Scenario: 有效数据库测试邀请码注册
- **WHEN** 用户提交注册请求且邀请码匹配数据库中 type=test、未过期、usedCount<maxUses 的记录时
- **THEN** 注册成功，系统在同一事务中：(1) 创建 User 记录，(2) 创建 UserRole 记录关联 user 角色，(3) InvitationCode.usedCount 增 1 但 MUST NOT 设置 usedBy（允许多人复用），(4) 自动登录签发 token

#### Scenario: 已使用的标准邀请码
- **WHEN** 用户提交的邀请码对应的 InvitationCode.usedBy 不为 null 时
- **THEN** 系统返回 400 错误，错误码 `INVITATION_CODE_USED`

#### Scenario: 无效邀请码
- **WHEN** 用户提交的邀请码既不匹配环境变量也不在数据库中时
- **THEN** 系统返回 400 错误，错误码 `INVITATION_CODE_INVALID`

#### Scenario: 邀请码已过期
- **WHEN** 数据库邀请码设置了 expiresAt 且已过期时
- **THEN** 系统返回 400 错误，错误码 `INVITATION_CODE_EXPIRED`

#### Scenario: 测试邀请码达到使用上限
- **WHEN** 测试邀请码类型在数据库中存在（type=test, maxUses 设置），且 usedCount >= maxUses 时
- **THEN** 系统返回 400 错误，错误码 `INVITATION_CODE_MAX_USES`

### Requirement: Admin 邀请码管理

系统 SHALL 在 admin 后台提供邀请码管理功能，包括生成、列表查看、作废操作，MUST NOT 展示环境变量中的测试邀请码。

证据来源：
- `packages/server/src/modules/admin/invitation.controller.ts`
- `packages/admin/src/features/invitations/`

#### Scenario: 生成标准邀请码
- **WHEN** 拥有 `invitations:create` 权限的管理员提交生成邀请码请求（含 note 备注）时
- **THEN** 系统创建 type=standard 的 InvitationCode 记录，返回生成的 code 字符串给管理员

#### Scenario: 生成带使用次数限制的测试邀请码
- **WHEN** 拥有 `invitations:create` 权限的管理员选择生成测试邀请码并指定 maxUses 和可选的 expiresAt 时
- **THEN** 系统创建 type=test 的 InvitationCode 记录，maxUses 为指定值，usedCount 初始为 0

#### Scenario: 邀请码列表
- **WHEN** 拥有 `invitations:read` 权限的管理员查看邀请码列表时
- **THEN** 系统返回分页列表，包含 code、type、note、createdBy(管理员名称)、usedBy(用户邮箱或null)、usedCount、maxUses、expiresAt、createdAt、status；MUST NOT 包含环境变量测试邀请码

#### Scenario: 作废邀请码
- **WHEN** 拥有 `invitations:revoke` 权限的管理员作废一个未使用（usedBy=null）的邀请码时
- **THEN** 系统将该邀请码的 `expiresAt` 设置为当前时间，使其立即过期无法再用于注册（复用过期校验逻辑，无需额外 revokedAt 字段）；已使用的邀请码不可作废

#### Scenario: 邀请码操作权限控制
- **WHEN** 非管理员或无 invitations:create/invitations:revoke 权限的用户尝试操作邀请码时
- **THEN** 系统返回 403 Forbidden

### Requirement: 邀请码与用户关联显示

系统 SHALL 在用户列表中显示用户注册时使用的邀请码信息。

证据来源：
- `packages/server/src/modules/admin/admin.service.ts` (用户列表)
- `packages/admin/src/features/users/`

#### Scenario: 用户列表显示邀请码
- **WHEN** 管理员查看用户列表时
- **THEN** 对每个用户，如 invitationCodeId 不为 null，显示关联邀请码的 code；环境变量测试邀请码注册的用户显示"测试邀请码"标签
