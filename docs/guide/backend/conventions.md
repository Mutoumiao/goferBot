# 后端编码规范

> GoferBot 后端（NestJS + Fastify）编码约定与架构合规指南。
>
> **必读时机**：开发任何 `b-*`、`d-*`、`i-*` track 的 issue 前。
> **配套文档**：`docs/guide/backend/README.md`（开发流程）、`docs/adrs/`（架构决策）。

---

## 目录

| 章节 | 内容 |
|------|------|
| [验证方案](#验证方案) | Zod 强制规范、禁止 class-validator |
| [响应格式](#响应格式) | ResponseInterceptor 统一包装 |
| [DTO 模式](#dto-模式) | 标准模板、常见字段类型 |
| [错误处理](#错误处理) | 统一异常格式、错误码规范 |
| [分页规范](#分页规范) | Prisma paginate 使用约定 |
| [架构合规检查清单](#架构合规检查清单) | 编码前/编码后强制检查项 |

---

## 验证方案

**决策来源**：ADR 0004、ADR 0005

### 强制规则

- **所有 DTO 必须使用 Zod schema + `createZodDto`**
- **禁止引入** `class-validator`、`class-transformer`、`@nestjs/class-validator`
- **禁止**在 Controller 上使用 `@UsePipes(ValidationPipe)`（NestJS 原生 ValidationPipe）
- 全局 `ZodValidationPipe` 已在 `app.module.ts` 注册，**无需额外配置**
- 查询参数（`@Query()`）和请求体（`@Body()`）均走同一套 Zod 验证

### DTO 标准模板

```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const xxxSchema = z.object({
  // 字符串
  name: z.string().min(1, '名称不能为空').max(100, '名称过长').describe('名称'),

  // 邮箱
  email: z.string().email('请输入有效的邮箱地址').describe('邮箱'),

  // 数值（强制转换）
  page: z.coerce.number().int().min(1).default(1).describe('页码'),

  // 布尔值（URL 查询参数常用）
  isActive: z
    .union([z.boolean(), z.string(), z.number()])
    .transform((v) => {
      if (typeof v === 'boolean') return v
      if (typeof v === 'string') return v === 'true' || v === '1'
      if (typeof v === 'number') return v === 1
      return undefined
    })
    .optional()
    .describe('状态过滤'),

  // 枚举
  role: z.enum(['USER', 'ADMIN']).default('USER').describe('角色'),

  // 数组
  tags: z.array(z.string()).optional().describe('标签列表'),

  // 嵌套对象
  config: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
  }).optional(),
})

export class XxxDto extends createZodDto(xxxSchema) {}
```

### 常见错误（禁止）

| ❌ 错误做法 | ✅ 正确做法 |
|-----------|-----------|
| `@IsString()`、`@IsInt()`、`@IsBoolean()` 等 class-validator 装饰器 | `z.string()`、`z.coerce.number()`、`z.boolean()` |
| `@Type(() => Number)` 类型转换 | `z.coerce.number()` |
| `@UsePipes(new ValidationPipe({ transform: true }))` | 什么都不写，全局 ZodValidationPipe 自动生效 |
| 手动实例化 `ValidationPipe` | 使用 `ZodValidationPipe`（已由全局注册） |
| `class XxxDto { @IsOptional() name?: string }` | `export class XxxDto extends createZodDto(xxxSchema) {}` |

### 验证错误响应格式

ZodValidationPipe 会将校验失败转换为统一格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": [
      { "field": "email", "issue": "请输入有效的邮箱地址" },
      { "field": "page", "issue": "必须大于或等于 1" }
    ]
  }
}
```

---

## 响应格式

**决策来源**：ADR 0004

### 强制规则

- **所有 API 成功响应统一为 `{ data: T }` 格式**
- 由全局 `ResponseInterceptor` 自动包装，**Controller 中直接返回原始数据即可**
- **禁止**在 Controller 中使用 `@BypassResponse()`，除非有明确的架构豁免理由
- 当前唯一合法使用 `@BypassResponse()` 的场景：**SSE 流式响应**（`chat.controller.ts`）

### 标准响应示例

```typescript
// Controller 中直接返回原始数据
@Get('users')
async listUsers() {
  const result = await this.adminService.listUsers()
  return result  // ResponseInterceptor 自动包装为 { data: result }
}
```

### 分页响应格式

分页接口返回嵌套结构：

```json
{
  "data": {
    "items": [...],
    "pagination": {
      "total": 100,
      "size": 10,
      "currentPage": 1,
      "totalPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

**注意**：分页数据由 Service 返回 `{ items, pagination }`，Controller 直接返回，ResponseInterceptor 包装为 `{ data: { items, pagination } }`。

### 禁止的做法

| ❌ 错误做法 | ✅ 正确做法 |
|-----------|-----------|
| `@BypassResponse()` 绕过拦截器 | 直接 return，让 ResponseInterceptor 包装 |
| 手动返回 `{ data: result }` | 直接 return result |
| 返回 `{ items, pagination }` 给前端（绕过拦截器） | 让前端接收 `{ data: { items, pagination } }` |

---

## DTO 模式

### 分页查询 DTO

```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const pagerSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('页码，最小 1'),
  size: z.coerce.number().int().min(1).max(50).default(10).describe('每页条数，最小 1，最大 50'),
})

export class PagerDto extends createZodDto(pagerSchema) {}
```

### 扩展分页 DTO

```typescript
import { createZodDto } from 'nestjs-zod'
import { pagerSchema } from '../../../shared/dto/pager.dto.js'

export const adminUserListQuerySchema = pagerSchema.extend({
  search: z.string().optional().describe('邮箱模糊搜索'),
  isActive: z
    .union([z.boolean(), z.string(), z.number()])
    .transform((v) => {
      if (typeof v === 'boolean') return v
      if (typeof v === 'string') return v === 'true' || v === '1'
      if (typeof v === 'number') return v === 1
      return undefined
    })
    .optional()
    .describe('按状态过滤'),
})

export class AdminUserListQueryDto extends createZodDto(adminUserListQuerySchema) {}
```

### 状态更新 DTO

```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const updateUserStatusSchema = z.object({
  isActive: z.boolean({ message: 'isActive 必须是布尔值' }).describe('用户状态'),
})

export class UpdateUserStatusDto extends createZodDto(updateUserStatusSchema) {}
```

---

## 错误处理

### 强制规则

- **所有异常由全局 ExceptionFilter 捕获并标准化**
- Service 层抛出 NestJS 内置异常（`NotFoundException`、`ForbiddenException`、`BadRequestException` 等）
- **禁止**在 Controller 中手动构造错误响应
- 错误码使用 `code` + `message` 结构

### 标准错误响应格式

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "用户不存在"
  }
}
```

### Service 层抛出示例

```typescript
import { NotFoundException, ForbiddenException } from '@nestjs/common'

// 404
throw new NotFoundException({
  code: 'NOT_FOUND',
  message: '用户不存在',
})

// 403
throw new ForbiddenException({
  code: 'FORBIDDEN',
  message: '无权访问该资源',
})

// 400（验证错误由 ZodValidationPipe 自动处理，一般不需要手动抛）
throw new BadRequestException({
  code: 'INVALID_INPUT',
  message: '输入参数无效',
})
```

---

## 分页规范

### Prisma paginate 使用约定

```typescript
const result = await (this.prisma.user as any).paginate(
  {
    where: { /* 过滤条件 */ },
    orderBy: { createdAt: 'desc' },
    select: { /* 选择字段 */ },
  },
  { page: query.page ?? 1, size: query.size ?? 10 },
)

// result 结构：
// {
//   data: [...],
//   pagination: { total, size, currentPage, totalPage, hasNextPage, hasPrevPage }
// }
```

### Controller 返回分页数据

```typescript
@Get('users')
async listUsers(@Query() query: AdminUserListQueryDto) {
  const result = await this.adminService.listUsers(query)
  return result  // ResponseInterceptor → { data: { data: [...], pagination: {...} } }
}
```

**注意**：由于 ResponseInterceptor 的包装，前端实际收到的是 `{ data: { data: [...], pagination: {...} } }`。这是当前项目的统一约定。

---

## 架构合规检查清单

### 编码前强制检查

在编写任何后端代码前，确认以下事项：

- [ ] **ADR 合规**：本实现涉及哪些 ADR？（列出编号）是否违反任何已有决策？
- [ ] **验证方案**：是否使用 Zod schema + `createZodDto`？是否引入了 class-validator？
- [ ] **响应格式**：是否直接返回原始数据（不手动包装 `{ data: ... }`）？是否需要 `@BypassResponse()`？
- [ ] **依赖引入**：是否引入了新 npm 包？是否与现有技术栈冲突？
- [ ] **DTO 规范**：是否遵循标准 DTO 模板？查询参数是否使用 `z.coerce` 处理类型转换？

### 编码后强制检查

代码完成后，自查以下事项：

- [ ] **无 class-validator**：grep 确认文件中没有 `class-validator`、`class-transformer` 导入
- [ ] **无原生 ValidationPipe**：grep 确认没有 `@UsePipes(new ValidationPipe` 或 `new ValidationPipe`
- [ ] **响应格式统一**：grep 确认没有无正当理由的 `@BypassResponse()`
- [ ] **类型检查通过**：`pnpm type-check`
- [ ] **测试通过**：`pnpm test` 和 `pnpm test:integration`

### 发现冲突时的处理流程

若编码过程中发现「按 spec 实现会违反已有 ADR」：

1. **暂停编码**，不继续实现
2. **列出冲突**：具体说明哪个 ADR 的哪条决策被违反
3. **提出方案**：
   - 方案 A：修改当前实现以符合 ADR
   - 方案 B：申请 ADR 豁免（需说明理由和回归计划）
4. **等待确认**：获得明确指令后再继续

**禁止**：在未经确认的情况下，为了「局部简单」而绕过架构决策。

---

## 相关文档

- [ADR 0004: 云原生架构重构](../../adrs/0004-cloud-native-rearchitecture.md)
- [ADR 0005: pgvector 替代 Milvus](../../adrs/0005-pgvector-replaces-milvus.md)
- [后端开发流程](./README.md)
- [测试体系总览](../testing/README.md)
