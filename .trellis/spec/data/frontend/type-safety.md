# TypeScript 类型安全和 Zod 验证

> Data Schema 包中的 TypeScript 类型模式、Zod 验证和类型安全最佳实践。

---

## 概述

`packages/data` 是前后端共享的契约层，其核心价值在于提供**类型安全的数据验证**。本指南描述了如何使用 Zod Schema 和 TypeScript 类型确保数据完整性和类型安全。

---

## Zod Schema 基础

### Schema 定义

```typescript
import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
})
```

### Schema 验证

```typescript
const result = userSchema.safeParse({ id: '123', email: 'test@example.com', name: 'Test' })

if (result.success) {
  const user = result.data
} else {
  const errors = result.error.errors
}
```

### 常用 Zod 方法

| 方法 | 用途 | 示例 |
|------|------|------|
| `.min(n)` | 字符串最小长度 | `.min(1, '不能为空')` |
| `.max(n)` | 字符串最大长度 | `.max(255, '过长')` |
| `.email()` | 邮箱格式验证 | `.email('格式不正确')` |
| `.uuid()` | UUID 格式验证 | `.uuid('格式非法')` |
| `.int()` | 整数验证 | `.int('必须是整数')` |
| `.optional()` | 可选字段 | `.optional()` |
| `.nullable()` | 可空字段 | `.nullable()` |
| `.default(v)` | 默认值 | `.default('USER')` |
| `.describe(s)` | 字段描述 | `.describe('页码')` |
| `.coerce` | 类型强制转换 | `.coerce.number()` |
| `.transform(f)` | 转换函数 | `.transform((v) => v.trim())` |
| `.refine(f)` | 自定义验证 | `.refine((v) => v.length > 0)` |

---

## 类型派生

### 从 Schema 派生类型

使用 `z.infer<typeof schema>` 从 Zod Schema 派生 TypeScript 类型：

```typescript
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
})

export type User = z.infer<typeof userSchema>
```

### 类型导出模式

**方式一：直接在 Schema 文件中导出**

```typescript
export type User = z.infer<typeof userSchema>
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>
```

**方式二：在 types/ 目录集中导出**

```typescript
// types/chat.ts
import type { z } from 'zod'
import type { messageSchema, chatMessagesRequestSchema } from '../schemas/chat.schema.js'

export type Message = z.infer<typeof messageSchema>
export type ChatMessagesRequest = z.infer<typeof chatMessagesRequestSchema>
```

### 类型命名规范

| 类型 | 命名模式 | 示例 |
|------|---------|------|
| 基础实体 | PascalCase | `User`, `Message`, `Document` |
| 请求体 | `{Action}{Entity}Request` | `CreateUserRequest`, `UpdateDocumentRequest` |
| 响应体 | `{Entity}Response` | `AuthResponse`, `KbDetailResponse` |
| 列表响应 | `{Entity}ListResponse` | `MessageListResponse`, `KbListResponse` |
| 查询参数 | `{Entity}Query` | `AdminUserListQuery`, `CompanionListQuery` |

---

## 类型安全最佳实践

### 避免 `any` 类型

```typescript
// 禁止
export const metadataSchema = z.any()

// 推荐
export const metadataSchema = z.record(z.string(), z.unknown())
```

### 避免类型断言

```typescript
// 禁止
const user = data as User

// 推荐
const result = userSchema.safeParse(data)
if (result.success) {
  const user = result.data
}
```

### 类型守卫

使用 Zod Schema 作为类型守卫：

```typescript
function isUser(data: unknown): data is User {
  return userSchema.safeParse(data).success
}

if (isUser(data)) {
  // data 现在是 User 类型
}
```

### 泛型工具函数

使用泛型创建类型安全的工具函数：

```typescript
export function createPagedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: paginationSchema,
  })
}

export type PagedResponse<T> = z.infer<ReturnType<typeof createPagedResponseSchema<T>>>
```

---

## 共享类型契约

### 跨包类型共享

`packages/data` 作为共享契约层，被 `packages/server` 和 `packages/web`/`packages/admin` 同时依赖：

```
packages/data (Schema + Types)
      │
      ├──→ packages/server (使用 Schema 验证)
      │
      ├──→ packages/web (使用 Types 定义组件 props)
      │
      └──→ packages/admin (使用 Types 定义组件 props)
```

### 导入方式

**服务器端**：

```typescript
import { userSchema, loginRequestSchema } from '@goferbot/data'

async function login(dto: z.infer<typeof loginRequestSchema>) {
  const result = loginRequestSchema.safeParse(dto)
  // ...
}
```

**前端**：

```typescript
import type { User, LoginRequest } from '@goferbot/data'

interface LoginFormProps {
  onSubmit: (data: LoginRequest) => void
}

function useFetchUser(): UseQueryResult<User> {
  // ...
}
```

---

## 复杂类型模式

### 嵌套类型

```typescript
export const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  files: z
    .array(
      z.object({
        id: z.string(),
        fileName: z.string(),
        fileUrl: z.string(),
      }),
    )
    .optional(),
})

export type Message = z.infer<typeof messageSchema>
```

### 条件类型

```typescript
export type CategorySettingsMap = {
  providers: Record<string, ModelProvider>
  chat: ChatSettings
  rag: RagSettings
  companion: CompanionSettings
  indexing: IndexingSettings
  appearance: AppearanceSettings
}
```

### 常量类型

```typescript
export const MEMORY_INJECTION_LIMIT = 12 as const
export const MEMORY_KEYWORD_REGEX = /记住|以后|别再|我喜欢/i
```

---

## Zod 验证模式

### 请求体验证

```typescript
export const loginRequestSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  encryptedPassword: z
    .string()
    .min(1, '密码不能为空')
    .max(4096, '密码数据异常'),
  captchaId: z.string().min(1).optional(),
  captchaCode: z.string().min(1).optional(),
})
```

### 查询参数验证

```typescript
export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
  pageSize: z.coerce.number().int().min(1).max(50).default(10).describe('每页条数'),
  search: z.string().optional().describe('邮箱模糊搜索'),
})
```

### 条件验证

```typescript
export const moveDocumentRequestSchema = z
  .object({
    targetKbId: z.string().uuid('targetKbId 格式非法').optional(),
    targetFolderId: z.string().uuid('targetFolderId 格式非法').nullable().optional(),
  })
  .refine(
    ({ targetKbId, targetFolderId }) => targetKbId !== undefined || targetFolderId !== undefined,
    { message: 'targetKbId 与 targetFolderId 至少提供一个', path: ['targetKbId'] },
  )
```

### 类型转换

```typescript
function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return value === 'true' || value === '1'
  }
  if (typeof value === 'number') {
    return value === 1
  }
  return undefined
}

export const adminUserListQuerySchema = z.object({
  isActive: z
    .union([z.boolean(), z.string(), z.number()])
    .transform((v) => toBoolean(v))
    .optional(),
})
```

---

## 类型安全检查清单

### 新增 Schema 时

- [ ] 所有字段有明确的 Zod 类型
- [ ] 必填字段有验证规则
- [ ] 从 Schema 派生 TypeScript 类型
- [ ] 类型在 `types/` 目录或 Schema 文件中导出
- [ ] Schema 在 `index.ts` 中导出

### 修改 Schema 时

- [ ] 检查派生类型是否需要更新
- [ ] 检查其他包是否受影响
- [ ] 更新相关的验证规则

### 删除 Schema 时

- [ ] 删除派生类型
- [ ] 从 `index.ts` 中移除导出
- [ ] 检查其他包是否有引用

---

## 常见错误

1. **忘记派生类型**：定义了 Schema 但没有导出对应的 TypeScript 类型
2. **类型与 Schema 不一致**：手动定义类型，与 Schema 不同步
3. **使用 `any` 类型**：`z.any()` 绕过类型检查
4. **使用类型断言**：`as User` 绕过验证
5. **日期字段类型错误**：使用 `z.date()` 导致 JSON 序列化问题
6. **枚举值不一致**：不同 Schema 中使用不同的枚举值
7. **导出方式不一致**：有的在 Schema 文件导出类型，有的在 types/ 目录导出
8. **嵌套类型未定义**：嵌套对象没有对应的 Schema 定义

---

## 性能考虑

### Schema 编译

Zod Schema 在首次使用时编译，后续使用会缓存结果。对于复杂的 Schema，可以在应用启动时预编译：

```typescript
export const complexSchema = z.object({ /* ... */ })

// 预编译
complexSchema.safeParse({})
```

### 避免重复验证

在请求处理流程中，避免多次验证相同的数据：

```typescript
// 推荐：在入口处验证一次
async function handleRequest(req: Request) {
  const result = requestSchema.safeParse(await req.json())
  if (!result.success) {
    throw new Error('Invalid request')
  }
  // 后续直接使用 result.data
}
```

### 大型 Schema 拆分

对于超过 200 行的大型 Schema，拆分为多个文件：

```typescript
// companion.schema.ts — 基础 CRUD Schema
// companion-pipeline.schema.ts — LangGraph 管线 Schema
```