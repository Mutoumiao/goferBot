---
issue_id: b-14
type: feature-spec
status: draft
summary: Prisma 分页封装、Session 接口修复、RBAC 权限与 Admin 用户管理 API 的功能边界
---

# 功能规格：Admin 用户管理与基础设施规范化

## 用户故事

- 作为开发者，我希望 Prisma 有统一的分页封装，以便后续所有列表接口规范化
- 作为用户，我希望会话列表能正确加载且支持分页，以便管理大量历史会话
- 作为系统管理员，我希望通过 API 查看所有注册用户列表，以便了解平台用户情况
- 作为系统管理员，我希望通过 API 禁用/启用用户账号，以便管控异常账号
- 作为系统管理员，我希望禁用账号无法登录系统，以确保管控生效

## 边界

- 范围内：
  - Prisma Client 扩展（`paginate` + `exists`）
  - Session 列表接口响应格式修复与分页
  - User 表 `role` / `isActive` 字段
  - `RolesGuard` + `@Roles()` 装饰器
  - Admin 用户列表接口（`GET /admin/users`）
  - Admin 用户状态切换接口（`PATCH /admin/users/:id/status`）
  - 登录接口 `isActive` 校验
- 范围外：
  - 知识库/文件夹/文档列表分页（前端需要全量数据）
  - 管理后台前端界面
  - 操作审计日志
  - 除 USER/ADMIN 外的其他角色
  - 用户数据内容管理（知识库、文档、会话等）

## 涉及模块

- `processors/database/prisma.service.ts`
- `modules/session/session.service.ts`
- `modules/session/session.controller.ts`
- `auth/guards/roles.guard.ts`
- `auth/decorators/roles.decorator.ts`
- `modules/admin/admin.module.ts`
- `modules/admin/admin.controller.ts`
- `modules/admin/admin.service.ts`
- `auth/auth.service.ts`

## 相关功能

- 上游功能：JWT 认证系统（现有） — 提供登录态
- 下游功能：管理后台前端界面（后续批次） — 消费 Admin API
