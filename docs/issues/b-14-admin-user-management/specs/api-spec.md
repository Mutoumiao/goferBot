---
issue_id: b-14
type: api-spec
status: draft
summary: Admin 用户管理 API 端点、分页 DTO、RBAC 守卫与 Session 列表修复
---

# API 规格：Admin 用户管理与基础设施规范化

## 通用分页响应

所有分页接口统一返回以下结构：

```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "size": 10,
    "currentPage": 1,
    "totalPage": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## 端点

### GET /api/sessions

#### 变更说明
修复前后端格式不一致问题，从直接返回数组改为分页结构。

#### 认证
Bearer Token（JwtAuthGuard）

#### 查询参数
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | integer | 否 | 1 | 页码，最小 1 |
| limit | integer | 否 | 50 | 每页条数，最小 1，最大 50 |

#### 响应 200
```json
{
  "items": [
    {
      "id": "string",
      "userId": "string",
      "title": "string",
      "provider": "string | null",
      "model": "string | null",
      "createdAt": "2026-06-03T00:00:00Z",
      "updatedAt": "2026-06-03T00:00:00Z",
      "messageCount": 10
    }
  ],
  "pagination": {
    "total": 100,
    "size": 50,
    "currentPage": 1,
    "totalPage": 2,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### GET /admin/users

#### 认证
Bearer Token（JwtAuthGuard + RolesGuard）+ Role = ADMIN

#### 查询参数
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | integer | 否 | 1 | 页码，最小 1 |
| size | integer | 否 | 10 | 每页条数，最小 1，最大 50 |
| search | string | 否 | - | 邮箱模糊搜索 |
| isActive | boolean | 否 | - | 按状态过滤 |

#### 响应 200
```json
{
  "data": [
    {
      "id": "string",
      "email": "user@example.com",
      "name": "string | null",
      "avatar": "string | null",
      "role": "USER | ADMIN",
      "isActive": true,
      "createdAt": "2026-06-03T00:00:00Z",
      "updatedAt": "2026-06-03T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "size": 10,
    "currentPage": 1,
    "totalPage": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未提供 Token 或 Token 无效 | `{ "message": "Unauthorized", "statusCode": 401 }` |
| 403 | Token 有效但角色不是 ADMIN | `{ "message": "Forbidden resource", "statusCode": 403 }` |

---

### PATCH /admin/users/:id/status

#### 认证
Bearer Token（JwtAuthGuard + RolesGuard）+ Role = ADMIN

#### 请求
```json
{
  "isActive": false
}
```

#### 响应 200
```json
{
  "id": "string",
  "email": "user@example.com",
  "name": "string | null",
  "role": "USER",
  "isActive": false,
  "updatedAt": "2026-06-03T00:00:00Z"
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | 请求体缺少 isActive 字段 | `{ "message": "...", "statusCode": 400 }` |
| 401 | 未提供 Token 或 Token 无效 | `{ "message": "Unauthorized", "statusCode": 401 }` |
| 403 | Token 有效但角色不是 ADMIN | `{ "message": "Forbidden resource", "statusCode": 403 }` |
| 404 | 用户 ID 不存在 | `{ "message": "用户不存在", "statusCode": 404 }` |

---

### POST /auth/login（变更）

#### 变更说明
登录时增加 `isActive` 校验。

#### 错误码（新增）
| 码 | 场景 | 响应体 |
|----|------|--------|
| 403 | 账号已被禁用 | `{ "code": "ACCOUNT_DISABLED", "message": "账号已被禁用" }` |

---

## DTO 定义

### PagerDto
```ts
import { z } from 'zod';

export const PagerSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  size: z.coerce.number().min(1).max(50).default(10),
});

export type PagerDto = z.infer<typeof PagerSchema>;
```

### AdminUserListQueryDto（extends PagerDto）
```ts
import { z } from 'zod';
import { PagerSchema } from './pager.schema';

export const AdminUserListQuerySchema = PagerSchema.extend({
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type AdminUserListQueryDto = z.infer<typeof AdminUserListQuerySchema>;
```

### UpdateUserStatusDto
```ts
import { z } from 'zod';

export const UpdateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export type UpdateUserStatusDto = z.infer<typeof UpdateUserStatusSchema>;
```

### 管道使用说明

项目中 `ZodValidationPipe` 已在 `app.module.ts` 作为全局 `APP_PIPE` 注册，所有 Controller 自动生效，无需在 Controller 或方法上显式添加 `@UsePipes()`。

```ts
// app.module.ts 全局注册
{
  provide: APP_PIPE,
  useClass: ZodValidationPipe,
}
```

DTO 通过 `createZodDto` 创建即可自动被校验：

```ts
import { createZodDto } from 'nestjs-zod';

export class AdminUserListQueryDto extends createZodDto(adminUserListQuerySchema) {}
```

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| Session 列表分页 | `tests/unit/server/session.service.spec.ts` | `AC-02: list returns paginated result with items and pagination` |
| Admin 用户列表 | `tests/integration/admin-user-management.spec.ts` | `AC-05: admin users list with pagination search and filter` |
| Admin 切换用户状态 | `tests/integration/admin-user-management.spec.ts` | `AC-06: admin can toggle user active status` |
| 禁用用户登录被拒 | `tests/integration/auth.spec.ts` | `AC-07: login rejects disabled user with 403` |
| RolesGuard 权限校验 | `tests/unit/server/roles.guard.spec.ts` | `AC-04: RolesGuard allows ADMIN and rejects USER` |
| Prisma paginate 扩展 | `tests/unit/server/prisma-pagination.spec.ts` | `AC-01: paginate returns correct data and pagination metadata` |

---

## 守卫与装饰器

### @Roles(...roles: Role[])
- 作用：标记 Controller 方法所需角色
- 用法：`@Roles(Role.ADMIN)`
- 位置：`auth/decorators/roles.decorator.ts`

### RolesGuard
- 作用：校验当前用户角色是否在 `@Roles()` 声明的列表中
- 配合：`@UseGuards(JwtAuthGuard, RolesGuard)`
- 位置：`auth/guards/roles.guard.ts`
- 逻辑：
  1. 读取 `@Roles()` 声明的角色列表
  2. 若无 `@Roles()`，放行
  3. 从请求中提取 `user.role`
  4. 若用户角色在列表中，放行；否则抛出 `ForbiddenException`
