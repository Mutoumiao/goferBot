# GoferBot Discovery Report

## 7. 复杂模块

### 7.13 Admin 后端 API — Auth RBAC 管理端消费者

**数据来源**：[admin.controller.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/admin.controller.ts)、[role.controller.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/role.controller.ts)、[invitation.controller.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/invitation.controller.ts)、[admin.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/admin.service.ts)、[role.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/role.service.ts)、[permission.seeder.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/admin/seeders/permission.seeder.ts)

Admin 后端不是独立业务模块，而是 Auth RBAC 基础设施的**管理端消费者**。它直接依赖 AuthModule 和 AuthRepositoryModule，复用 JwtAuthGuard + AppGuard + PermissionGuard 进行鉴权。**PermissionService 和 PermissionRepository 已从 Auth 模块移入 Admin 模块**。

**三个 Controller**：

| Controller | 路由前缀 | 守卫 | 权限码 |
|-----------|---------|------|--------|
| AdminController | `admin/` | JwtAuthGuard + AppGuard + PermissionGuard | `users:read/create/update/delete/resetPassword` |
| RoleController | `admin/roles/` | JwtAuthGuard + PermissionGuard | `roles:read/create/update/delete` |
| InvitationController | `admin/invitations/` | JwtAuthGuard + PermissionGuard | `invitations:read/create/revoke` |

**AdminService 核心功能**：

- `listUsers(query)` — 分页用户列表，支持 email 模糊搜索 + isActive 过滤，返回 roles 数组 + invitationCode 关联信息
- `createUser(dto)` — 创建用户（含角色多选分配），验证邮箱唯一性，事务内创建 User + UserRole 关联，非超管不能分配 admin/super_admin 角色
- `updateUserStatus(userId, dto)` — 启用/禁用，禁用时撤销所有会话+refresh token；SUPER_ADMIN_PROTECTED 保护（不能禁用最后一个超管）
- `resetPassword(userId, dto)` — 重置管理员密码（仅对有 admin/super_admin 角色的用户开放），不撤销现有会话

**RoleService 核心功能**：

- `listRoles()` — 通过 `UserRole.groupBy('roleCode')` 动态发现 + 预置角色 = 完整列表（不再仅按 app 过滤，admin 端可见所有角色）
- `listPermissions()` — 按 group 分组（dashboard/users/roles/invitations/audit/settings/system），分组名中文映射
- `createRole(dto)` / `updateRole(id, dto)` / `deleteRole(id)` — 系统角色（isSystem=true）不可删除，super_admin 权限不可修改

**InvitationService 核心功能**：

- `generate(dto)` — 生成 GF-XXXX-XXXX 格式邀请码，standard 型一码一账户，multi 型支持 maxUses/expiresAt
- `list(query)` — 分页列表，按类型/状态筛选
- `revoke(id)` — 作废未使用的邀请码（设置 expiresAt=now）

**PermissionSeeder**（启动自动初始化）：
- `OnModuleInit` 执行，早于 `SuperAdminBootstrap` 的 `OnApplicationBootstrap`
- 幂等 upsert 预置角色（super_admin/admin/user）+ 权限码分配
- 运行时检测新增权限码 → 自动追加到 super_admin

**AdminAuditLog**：管理员创建用户、重置密码、角色变更、邀请码操作均写入审计日志（action/targetType/targetId/operatorId/details）

**关键依赖链**: `AdminModule → AuthModule + AuthRepositoryModule → JwtAuthGuard + AppGuard + PermissionGuard + PermissionService + PermissionSeeder`

**v22 移除**：Sessions 会话管理（sessions 页面/接口）和 RAG Observability（rag-observability 页面/接口），后续通过 Tracing 实现。
