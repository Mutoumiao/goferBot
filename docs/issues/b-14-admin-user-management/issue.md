---
id: b-14
status: closed
track: backend
priority: p1
summary: Prisma 分页封装、Session 接口修复、RBAC 权限与 Admin 用户管理 API
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

本 issue 是一个纯后端垂直切片，涵盖以下四个关联功能：

1. **Prisma 统一分页封装**：为 `PrismaService` 扩展 `$allModels.paginate()` 和 `$allModels.exists()` 方法，提供类型安全的分页查询能力
2. **Session 列表接口修复**：修复前后端响应格式不一致的 bug（后端返回数组但前端按 `{ items }` 解析），并引入分页
3. **RBAC 权限基础**：新增 `role` 和 `isActive` 字段，实现 `@Roles()` 装饰器和 `RolesGuard`
4. **Admin 用户管理 API**：提供 `GET /admin/users`（列表 + 分页 + 搜索 + 过滤）和 `PATCH /admin/users/:id/status`（禁用/启用）

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 本 issue 无前端改动，Session 分页后前端已按 `{ items }` 解析，无需调整
- 知识库/文件夹/文档列表暂不分页（前端需要全量数据做排序和树形展示）
- 初始部署后需手动将至少一个现有用户提升为 `ADMIN`
- 参考模板项目 `nest-http-prisma-zod` 的 `prisma.instance.ts` 实现分页扩展
- 本次 issue 最初错误地使用了 class-validator，已于 2026-06-04 修复为统一使用 ZodValidationPipe
