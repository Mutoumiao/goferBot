# Admin - 管理后台

## Purpose（目的）

定义 GoferBot 管理后台（Admin App）的用户管理、角色管理、审计日志、系统配置、Dashboard 统计等功能规范。Admin App 是基于 React + TanStack Start 的独立前端应用。

## Requirements（需求）

### Requirement: 用户管理
系统应允许管理员查看、创建、更新、禁用用户账户，MUST NOT 支持物理删除用户（仅软删除/禁用）。超级管理员可直接创建任意角色的用户（包括管理员），创建时勾选角色即可。

证据来源：
- `packages/admin/src/routes/_authenticated/users.tsx`
- `packages/admin/src/features/users/services.ts`
- `packages/server/src/modules/admin/admin.controller.ts`
- `packages/server/src/modules/admin/admin.service.ts`

#### Scenario: 列出用户
- **WHEN** 管理员查看用户管理页面时
- **THEN** 系统返回所有用户的分页列表，包含用户邮箱、姓名、角色列表（多角色）、状态、注册邀请码、创建时间、最后登录时间

#### Scenario: 创建用户（直接创建）
- **WHEN** 超级管理员在用户列表页面点击"创建用户"，填写邮箱、初始密码、姓名，并勾选一个或多个角色（如勾选 admin 角色即为管理员）时
- **THEN** 系统创建 User 记录和对应的 UserRole 关联记录，MUST NOT 设置 mustChangePassword，新用户可直接使用指定密码登录

#### Scenario: 创建用户权限控制
- **WHEN** 非超级管理员尝试创建用户时
- **THEN** 系统根据 `users:create` 权限判断；普通 admin 角色可创建普通用户但 MUST NOT 创建管理员角色用户

#### Scenario: 重置管理员密码
- **WHEN** 超级管理员在用户列表中对管理员用户（具有 admin 或 super_admin 角色的用户）点击"重置密码"，输入新密码时
- **THEN** 系统直接更新该用户密码为 bcrypt 哈希值，MUST NOT 设置 mustChangePassword，MUST NOT 撤销该用户现有会话（管理员主动重置，信任管理员操作）

#### Scenario: 不重置普通用户密码
- **WHEN** 管理员在用户列表中查看普通 web 用户时
- **THEN** MUST NOT 显示"重置密码"按钮；普通 web 用户忘记密码本期不提供重置功能（邮箱找回暂不实现）

#### Scenario: 禁用用户
- **WHEN** 管理员禁用用户账户时
- **THEN** 系统将 isActive 设为 false，撤销该用户所有活跃会话和 refresh token，阻止新的登录

#### Scenario: 启用用户
- **WHEN** 管理员重新启用被禁用的用户时
- **THEN** 系统将 isActive 设为 true，用户可以重新登录

#### Scenario: 超级管理员保护
- **WHEN** 管理员尝试禁用或删除 SUPER_ADMIN 账户时
- **THEN** 系统应阻止此操作；系统中 MUST 至少保留一个启用状态的 super_admin 用户

#### Scenario: 不提供普通用户密码找回和管理员重置
- **WHEN** 普通 web 用户忘记密码时
- **THEN** 系统不提供自助找回密码功能（邮箱找回暂不做），管理员也不能为普通用户重置密码；需通过禁用旧账号、创建新账号处理

### Requirement: 角色管理
系统应允许管理员创建、更新和删除具有可配置权限集的自定义角色，系统预置角色（isSystem=true）MUST NOT 被删除。角色与 app 绑定，不同 app 的角色独立管理。

证据来源：
- `packages/admin/src/routes/_authenticated/roles.tsx`
- `packages/admin/src/features/roles/services.ts`
- `packages/admin/src/features/users/components/RoleSelect.tsx`
- `packages/server/src/modules/admin/role.controller.ts`
- `packages/server/src/modules/admin/role.service.ts`
- `packages/data/src/constants/permissions.ts`
- `packages/data/src/constants/role-permissions.ts`

#### Scenario: 创建自定义角色
- **WHEN** 管理员创建一个新角色时
- **THEN** 系统要求指定角色名称、code（kebab-case）、所属 app（web/admin）、描述，并选择一组权限码；角色创建后可分配给用户

#### Scenario: 为用户分配角色
- **WHEN** 管理员为用户分配或移除角色时
- **THEN** 系统通过 UserRole 关联表维护用户-角色关系，分配/移除后立即清除该用户的权限缓存

#### Scenario: 删除自定义角色
- **WHEN** 管理员尝试删除未分配给任何用户的自定义角色时
- **THEN** 系统允许删除

#### Scenario: 删除已分配用户的角色
- **WHEN** 管理员尝试删除已分配给活跃用户的角色时
- **THEN** 系统应提示该角色下有 N 个用户，要求先解除分配或确认强制解除（解除分配后用户权限缓存立即失效）

#### Scenario: 系统角色不可删除
- **WHEN** 管理员尝试删除 isSystem=true 的预置角色（super_admin/admin/user）时
- **THEN** 系统返回 400 错误，MUST NOT 允许删除系统角色

#### Scenario: 系统角色权限不可随意修改
- **WHEN** 管理员尝试修改 super_admin 角色的权限时
- **THEN** 系统禁止修改（super_admin 始终拥有所有权限通配符）；admin 和 user 系统角色的权限可调整但需二次确认

#### Scenario: 权限码体系
- **WHEN** 系统初始化权限体系时
- **THEN** 系统 SHALL 定义以下权限分组（共 21 个权限码）：
  - 仪表盘：dashboard:read
  - 用户管理：users:read, users:create, users:update, users:delete, users:reset-password
  - 角色管理：roles:read, roles:create, roles:update, roles:delete
  - 邀请码管理：invitations:read, invitations:create, invitations:update, invitations:delete
  - 审计日志：audit:read, audit:export
  - 系统配置：settings:read, settings:update
  - 系统运维：system:metrics, system:maintenance, system:logs
- **AND** 预置 3 个角色：
  - `super_admin`（admin app）：所有权限（通配符 `*`）
  - `admin`（admin app）：全部 21 个权限
  - `user`（web app）：无管理权限码，仅可使用 web 端业务功能
- **AND** 权限常量（`PERMISSIONS`、`ROLE_PERMISSIONS`、`PERMISSION_GROUPS`）MUST 在 `@goferbot/data` 包中定义，前后端统一导入，禁止各自硬编码

#### Scenario: 角色列表 API 返回所有角色
- **WHEN** 前端调用 `GET /admin/roles` 获取角色列表时
- **THEN** 系统返回所有角色（包括 `app='web'` 的 `user` 角色），不按 app 字段过滤
- **AND** 系统角色（super_admin/admin/user）与自定义角色统一展示，通过 `isSystem` 字段区分

#### Scenario: 角色分配规则
- **WHEN** 管理员为用户分配角色时
- **THEN** `super_admin` 角色 MUST NOT 出现在分配列表中
- **AND** 当前登录用户拥有的角色在分配列表中设为禁用状态（tooltip 提示"无法分配与您相同的角色"）
- **AND** 角色选项动态从后端 API 获取，新增自定义角色自动可见

### Requirement: 邀请码管理页面
Admin 后台 SHALL 提供邀请码管理页面，支持生成、查看、作废邀请码。

证据来源：
- `packages/admin/src/routes/_authenticated/invitations.tsx`
- `packages/admin/src/features/invitations/`

#### Scenario: 邀请码列表页面
- **WHEN** 拥有 invitations:read 权限的管理员访问邀请码管理页面时
- **THEN** 系统显示邀请码分页列表，包含 code、类型（标准/测试）、备注、创建者、使用者、使用次数、创建时间、状态

#### Scenario: 生成邀请码对话框
- **WHEN** 管理员点击"生成邀请码"按钮时
- **THEN** 弹出对话框，选择类型（标准/测试），填写备注（可选），测试类型可指定最大使用次数；确认后生成邀请码并一次性显示给管理员（生成后不再明文展示完整 code）

#### Scenario: 作废邀请码
- **WHEN** 拥有 `invitations:revoke` 权限的管理员对未使用的邀请码点击"作废"时
- **THEN** 系统将该邀请码的 expiresAt 设置为当前时间使其立即过期，无法再用于注册；已使用的邀请码无作废按钮

### Requirement: 管理员创建用户直接指定角色
超级管理员 SHALL 在用户列表中直接创建用户，通过角色多选框分配一个或多个角色。

证据来源：
- `packages/admin/src/features/users/CreateUserDialog.tsx`

#### Scenario: 创建用户对话框
- **WHEN** 超级管理员点击"创建用户"时
- **THEN** 弹出对话框，包含字段：邮箱、初始密码、姓名、角色多选（列出所有可用角色，可多选）；提交后创建用户并分配所选角色

#### Scenario: 创建普通用户
- **WHEN** 超级管理员创建用户时仅勾选 user 角色
- **THEN** 创建普通用户账户，仅能登录 web 端

#### Scenario: 创建管理员
- **WHEN** 超级管理员创建用户时勾选 admin 角色（可同时勾选其他角色）
- **THEN** 创建管理员账户，可登录 admin 后台

#### Scenario: 非超级管理员创建限制
- **WHEN** 非超级管理员（仅 admin 角色）创建用户时
- **THEN** 角色选择框中 MUST NOT 显示 super_admin 角色，且创建的用户不能包含 admin 角色（仅能创建普通用户）

#### Scenario: 管理员操作审计日志
- **WHEN** 管理员执行以下操作时：创建用户、重置密码、启用/禁用用户、创建/更新/删除角色、分配/移除用户角色、生成/作废邀请码
- **THEN** 系统 MUST 写入 AdminAuditLog，记录操作类型、目标资源ID、操作人、操作时间、变更详情

### Requirement: 审计日志
系统应记录所有管理操作的审计日志，包括用户管理、角色变更和系统配置修改。

证据来源：
- `packages/admin/src/routes/_authenticated/audit.tsx`
- `packages/admin/src/features/audit/services.ts`

#### Scenario: 审计事件记录
- **WHEN** 管理员执行管理操作（创建/更新/删除用户、更改角色、修改配置）时
- **THEN** 系统记录操作类型、目标资源、管理员身份和时间戳

#### Scenario: 审计日志查询
- **WHEN** 管理员查询审计日志时
- **THEN** 系统返回经过筛选的分页结果，支持按日期范围、操作类型和目标用户进行筛选

### Requirement: 仪表盘统计
系统应提供一个仪表盘，展示用户、知识库、文档和系统使用情况的汇总统计信息。

证据来源：
- `packages/admin/src/features/dashboard/services.ts`
- `packages/admin/src/api/dashboard.ts`

#### Scenario: 系统概览指标
- **WHEN** 管理员查看仪表盘时
- **THEN** 系统显示总用户数、活跃会话数、知识库总数和文档总数

#### Scenario: 使用趋势
- **WHEN** 管理员查看使用统计数据时
- **THEN** 系统应提供关键指标的时间序列数据（新用户数、新知识库数、每日聊天会话数）

### Requirement: 三层 RBAC 守卫编排
Admin 前端 SHALL 通过三层守卫体系实现端到端权限控制，权限判断基于用户拥有的 roles 数组和对应权限码集合。

证据来源：
- `packages/admin/src/routes/_authenticated.tsx` (Layer 1 路由守卫)
- `packages/admin/src/components/layout/MenuConfig.tsx` (Layer 2 菜单过滤)
- `packages/admin/src/components/PermissionMatrix.tsx` (Layer 3 组件级权限)

#### Scenario: Layer 1 路由守卫 beforeLoad 编排
- **WHEN** 用户访问受保护路由时
- **THEN** `beforeLoad` 守卫 SHALL 按以下顺序执行：
  1. 等待认证模块初始化（`waitForAuthInit`，调用 `/auth/me` 验证，3s 超时）
  2. 检查认证状态，未认证则重定向到 `/login` 并携带 redirect 参数
  3. 检查路由所需权限（`routeMeta.requiredPermission`），用户无权限则重定向到 `/403`
- **AND** 执行顺序 MUST 为 `init → authenticated → permission → render`，移除 mustChangePassword 检查

#### Scenario: waitForAuthInit 验证 Cookie 有效性
- **WHEN** `waitForAuthInit` 执行时
- **THEN** 系统 SHALL 发起 `/auth/me` 请求验证 Cookie 中 token 的有效性，MUST NOT 仅依赖 localStorage 中的缓存状态判定已登录

#### Scenario: Layer 2 菜单过滤动态隐藏
- **WHEN** 渲染左侧导航菜单时
- **THEN** `useMenuConfig` SHALL 从 `ROUTES_REGISTER` 动态过滤菜单项：保留 `nav: true` 且（无 `requiredPermission` 或用户拥有该权限）的路由；移除 sessions 和 rag-observability 相关菜单项

#### Scenario: Layer 3 组件级 PermissionMatrix
- **WHEN** 管理员在角色编辑页面配置角色权限时
- **THEN** `PermissionMatrix` 组件 SHALL 显示所有权限码分组的 checkbox，与后端返回的角色 permissions 数组同步

#### Scenario: 路由注册表集中管理
- **WHEN** 维护路由元数据时
- **THEN** 系统 SHALL 通过 `ROUTES_REGISTER` 集中注册路由（path/nav/label/icon/requiredPermission），路由守卫、菜单过滤、面包屑 MUST 复用此注册表

### Requirement: 内置伴侣管理

Admin 应用 MUST 提供「内置伴侣」管理能力，用于配置 `source=system` 的平台伴侣目录。具备 `companions:read` 的管理员 MUST 可分页列表与查看详情；具备 `companions:write` 的管理员 MUST 可创建、更新完整人设、变更状态（draft / published / archived）。删除内置伴侣 MUST 仅归档（`status=archived`），MUST NOT 提供硬删除主路径（避免级联摧毁用户会话数据）。

证据来源：
- `packages/admin/src/features/companions/`
- `packages/server/src/modules/companion/companion-admin.controller.ts`
- 权限：`companions:read` / `companions:write`

#### Scenario: 列表内置伴侣

- **WHEN** 管理员打开内置伴侣列表页时
- **THEN** 系统 MUST 仅返回 `source=system` 的伴侣，并展示名称、状态、更新时间等摘要
- **AND** MUST 支持按 status 筛选（若 UI 提供筛选）

#### Scenario: 创建内置伴侣

- **WHEN** 具备 `companions:write` 的管理员提交完整人设表单时
- **THEN** 系统 MUST 创建 `source=system`、`userId=null` 的伴侣
- **AND** 默认状态 SHOULD 为 `draft`，直至管理员发布

#### Scenario: 发布后 Web 可见

- **WHEN** 管理员将内置伴侣状态设为 `published` 时
- **THEN** Web 官方推荐 Tab MUST 能展示该伴侣（对已登录用户）

#### Scenario: 归档内置

- **WHEN** 管理员归档内置伴侣时
- **THEN** 该伴侣 MUST 不再出现在 Web 官方列表
- **AND** 行记录 MUST 保留（非硬删）

#### Scenario: 无写权限

- **WHEN** 仅有 `companions:read` 或无伴侣权限的管理员访问写接口时
- **THEN** 系统 MUST 拒绝写入

#### Scenario: 菜单与三层守卫

- **WHEN** 配置 Admin 菜单与路由时
- **THEN** 内置伴侣入口 MUST 纳入既有三层 RBAC（路由 beforeLoad、菜单过滤、操作级权限）
- **AND** 无 `companions:read` 时 MUST NOT 展示可进入的管理入口（或进入后 403）

### Requirement: 内置伴侣权限码

系统 MUST 提供权限码 `companions:read` 与 `companions:write`。SUPER_ADMIN 与 ADMIN 预置角色 MUST 默认拥有二者；普通 USER 角色 MUST NOT 拥有 Admin 伴侣管理权限。

#### Scenario: 角色默认权限

- **WHEN** 使用预置 ADMIN 或 SUPER_ADMIN 角色登录 Admin 时
- **THEN** 该角色 MUST 具备内置伴侣读/写权限（除非被显式剥离）

#### Scenario: 权限矩阵可配置

- **WHEN** 超级管理员在角色权限矩阵中调整 companions 权限时
- **THEN** 系统 MUST 持久化并在后续请求中生效
