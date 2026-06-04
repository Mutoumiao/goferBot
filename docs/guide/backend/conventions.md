# 后端编码规范

> 后端（NestJS + Fastify）编码约定与架构合规指南。
>
> **必读时机**：开发任何 `b-*`、`d-*`、`i-*` track 的 issue 前。
> **配套文档**：`docs/guide/backend/README.md`（开发流程）、`docs/adrs/`（架构决策）。

---

## 目录

| 章节 | 内容 |
|------|------|
| [验证方案](#验证方案) | Zod 强制规范、禁止 class-validator |
| [响应格式](#响应格式) | ResponseInterceptor 统一包装 |
| [DTO 模式](#dto-模式) | 标准模板、扩展方式 |
| [错误处理](#错误处理) | 统一异常格式 |
| [分页规范](#分页规范) | Prisma paginate 使用约定 |
| [架构合规检查清单](#架构合规检查清单) | 编码前/编码后强制检查项 |

---

## 验证方案

**决策来源**：ADR 0001

### 强制规则

- **所有 DTO 必须使用 Zod schema + `createZodDto`**
- **禁止引入** `class-validator`、`class-transformer`、`@nestjs/class-validator`
- **禁止**在 Controller 上使用 `@UsePipes(ValidationPipe)`（NestJS 原生）
- 全局 `ZodValidationPipe` 已在 `app.module.ts` 注册，**无需额外配置**
- 查询参数（`@Query()`）和请求体（`@Body()`）均走同一套 Zod 验证

### DTO 标准模板

```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const xxxSchema = z.object({
  // 基础类型
  name: z.string().min(1).max(100).describe('名称'),

  // 数值（URL 参数强制转换）
  page: z.coerce.number().int().min(1).default(1).describe('页码'),

  // 布尔值（URL 查询参数专用模式）
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

  // 其他类型：枚举 z.enum()、数组 z.array()、嵌套对象 z.object()、
  // 可选 .optional()、默认值 .default()、联合 z.union() 等用法与标准 Zod 一致
})

export class XxxDto extends createZodDto(xxxSchema) {}
```

### 常见违规速查

| ❌ 禁止 | ✅ 正确 |
|--------|--------|
| `@IsString()`、`@IsInt()` 等 class-validator 装饰器 | `z.string()`、`z.coerce.number()` |
| `@Type(() => Number)` 类型转换 | `z.coerce.number()` |
| `@UsePipes(new ValidationPipe(...))` | 不写，全局 ZodValidationPipe 自动生效 |
| 手动实例化 `ValidationPipe` | 使用全局已注册的 `ZodValidationPipe` |
| `class XxxDto { @IsOptional() name?: string }` | `class XxxDto extends createZodDto(schema) {}` |
| 手动返回 `{ data: result }` | 直接 `return result` |
| `@BypassResponse()` 无正当理由 | 移除，让 ResponseInterceptor 包装 |

### 验证错误响应格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": [
      { "field": "{fieldName}", "issue": "{错误消息}" }
    ]
  }
}
```

---

## 响应格式

**决策来源**：ADR 0001

### 强制规则

- **所有 API 成功响应统一为 `{ data: T }` 格式**
- 由全局 `ResponseInterceptor` 自动包装，**Controller 直接返回原始数据**
- **禁止**`@BypassResponse()`，除非有架构豁免理由
- 唯一合法场景：**SSE 流式响应**

### 标准响应示例

```typescript
@Get('{资源}')
async list() {
  const result = await this.service.list()
  return result  // ResponseInterceptor → { data: result }
}
```

### 分页响应格式

Service 返回 `{ items, pagination }`，Controller 直接 `return result`，前端收到：

```json
{
  "data": {
    "items": [...],
    "pagination": {
      "total": 100, "size": 10, "currentPage": 1,
      "totalPage": 10, "hasNextPage": true, "hasPrevPage": false
    }
  }
}
```

---

## DTO 模式

### 分页查询 DTO

```typescript
export const pagerSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
  size: z.coerce.number().int().min(1).max(50).default(10).describe('每页条数'),
})
export class PagerDto extends createZodDto(pagerSchema) {}
```

### 扩展方式

```typescript
// 方式 1：extend 复用
export const listQuerySchema = pagerSchema.extend({
  search: z.string().optional().describe('搜索关键词'),
})

// 方式 2：独立 schema
export const updateStatusSchema = z.object({
  isActive: z.boolean().describe('状态'),
})
```

---

## 错误处理

### 强制规则

- **所有异常由全局 ExceptionFilter 捕获并标准化**
- Service 层抛出 NestJS 内置异常（`NotFoundException`、`ForbiddenException` 等）
- **禁止**在 Controller 中手动构造错误响应
- 错误码使用 `code` + `message` 结构

### 标准错误响应格式

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "{资源}不存在"
  }
}
```

### Service 层抛出示例

```typescript
import { NotFoundException } from '@nestjs/common'

throw new NotFoundException({
  code: 'NOT_FOUND',
  message: '{资源}不存在',
})
```

其他异常类型同理：`ForbiddenException`（code: FORBIDDEN）、`BadRequestException`（code: INVALID_INPUT）。

---

## 分页规范

### Prisma paginate 使用约定

```typescript
const result = await (this.prisma.{model} as any).paginate(
  { where: {/*...*/}, orderBy: { createdAt: 'desc' } },
  { page: query.page ?? 1, size: query.size ?? 10 },
)
// result: { data: [...], pagination: { total, size, currentPage, totalPage, hasNextPage, hasPrevPage } }
```

### Controller 返回

```typescript
@Get('{资源}')
async list(@Query() query: ListQueryDto) {
  const result = await this.service.list(query)
  return result  // ResponseInterceptor → { data: { data: [...], pagination: {...} } }
}
```

> 注意：前端实际收到 `{ data: { data: [...], pagination: {...} } }`，这是项目统一约定。

---

## 架构合规检查清单

### 编码前检查

- [ ] **ADR 合规**：涉及哪些 ADR？是否违反已有决策？
- [ ] **验证方案**：使用 Zod schema + `createZodDto`？未引入 class-validator？
- [ ] **响应格式**：直接返回原始数据？无无正当理由的 `@BypassResponse()`？
- [ ] **依赖引入**：新 npm 包是否与现有技术栈冲突？
- [ ] **DTO 规范**：查询参数使用 `z.coerce` 处理类型转换？

### 编码后检查

- [ ] **无 class-validator**：`grep -r "class-validator" src/` 无结果
- [ ] **无原生 ValidationPipe**：`grep -r "@UsePipes(new ValidationPipe" src/` 无结果
- [ ] **响应格式统一**：`grep -r "@BypassResponse" src/` 仅有 SSE 场景
- [ ] **类型检查通过**：`pnpm type-check`
- [ ] **测试通过**：`pnpm test` 和 `pnpm test:integration`

### 发现冲突时的处理流程

若「按 spec 实现会违反已有 ADR」：

1. **暂停编码**
2. **列出冲突**：具体说明哪个 ADR 的哪条决策被违反
3. **提出方案**：
   - 方案 A：修改当前实现以符合 ADR
   - 方案 B：申请 ADR 豁免（需说明理由和回归计划）
4. **等待确认**：获得明确指令后再继续

**禁止**：未经确认，为「局部简单」而绕过架构决策。

---

## 相关文档

- [ADR 0001: 云原生架构](../../adrs/0001-cloud-native-architecture.md)
- [后端开发流程](./README.md)
- [测试体系总览](../testing/README.md)
