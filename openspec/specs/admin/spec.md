# Admin - 管理后台

## Purpose（目的）

定义 GoferBot 管理后台（Admin App）的用户管理、角色管理、审计日志、系统配置、Dashboard 统计等功能规范。Admin App 是基于 React + TanStack Start 的独立前端应用。

## Requirements（需求）

### Requirement: 管理员认证
系统应提供专用的管理员登录流程，验证用户具有管理员角色（ADMIN 或 SUPER_ADMIN）。

证据来源：
- `packages/admin/src/routes/login.tsx`
- `packages/server/src/auth/dto/admin-login.dto.ts`
- `packages/server/src/auth/auth.controller.ts`

#### Scenario: 管理员登录
- **WHEN** 具有 ADMIN 或 SUPER_ADMIN 角色的用户通过管理界面登录时
- **THEN** 系统返回一个管理员作用域的 JWT token，并跳转到管理员仪表盘

#### Scenario: 非管理员被拒绝管理员登录
- **WHEN** 只有 USER 角色的用户尝试管理员登录时
- **THEN** 系统返回 403 Forbidden

#### Scenario: 管理员 token 不能访问用户端点
- **WHEN** 使用管理员 token 访问普通用户 API 端点时
- **THEN** 系统应根据端点的角色要求拒绝访问或适当限制访问范围

### Requirement: 用户管理
系统应允许管理员查看、创建、更新、禁用和删除用户账户。

证据来源：
- `packages/admin/src/routes/_authenticated/users.tsx`
- `packages/admin/src/features/users/services.ts`
- `packages/admin/src/api/admin.ts`
- `packages/server/src/modules/admin/admin.service.ts`

#### Scenario: 列出用户
- **WHEN** 管理员查看用户管理页面时
- **THEN** 系统返回所有用户的分页列表，包含用户角色和状态

#### Scenario: 禁用用户
- **WHEN** 管理员禁用用户账户时
- **THEN** 系统使该用户的所有活动会话失效，并阻止新的登录

#### Scenario: 超级管理员保护
- **WHEN** 管理员尝试禁用或删除 SUPER_ADMIN 账户时
- **THEN** 系统应阻止此操作（超级管理员只能由其他超级管理员修改）

### Requirement: 角色管理
系统应允许管理员创建、更新和删除具有可配置权限集的角色。

证据来源：
- `packages/admin/src/routes/_authenticated/roles.tsx`
- `packages/admin/src/features/roles/services.ts`
- `packages/server/src/modules/admin/role.service.ts`

#### Scenario: 创建自定义角色
- **WHEN** 管理员创建一个具有一组权限的新角色时
- **THEN** 系统存储该角色并使其可用于用户分配

#### Scenario: 为用户分配角色
- **WHEN** 管理员为用户分配角色时
- **THEN** 用户的有效权限应更新为匹配新角色

#### Scenario: 删除已分配用户的角色
- **WHEN** 管理员尝试删除已分配给活跃用户的角色时
- **THEN** 系统应发出警告，并要求在删除前重新分配或确认

#### Scenario: 权限码体系
- **WHEN** 系统初始化权限体系时
- **THEN** 系统 SHALL 定义 19 个权限码，分为 5 组：用户管理（users:read/create/update/delete）、角色管理（roles:read/create/update/delete）、审计日志（audit:read/export）、系统设置（settings:read/update）、系统运维（system:metrics/maintenance/logs）、API Keys（api-keys:read/create/update/delete）
- **AND** 预置 3 个角色权限集：`SUPER_ADMIN`（18 项全权限）、`ADMIN`（14 项，无 users:delete + roles:create/update/delete）、`USER`（2 项只读）

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
