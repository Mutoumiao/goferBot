# Schema 定义模式和最佳实践

> Data Schema 包中 Zod Schema 的定义规范和最佳实践。

---

## 概述

`packages/data` 是一个纯 Schema 包，不包含 React 组件。本指南描述的"组件"指的是**可复用的 Zod Schema 单元**及其组合模式。

---

## Schema 定义模式

### 基础实体 Schema

定义业务实体的基础数据结构：

```typescript
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: userRoleSchema.default('USER'),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string().optional(),
})
```

**规则**：
- 所有字段必须有明确类型
- 可选字段使用 `.optional()`
- 可空字段使用 `.nullable()`，通常与 `.optional()` 组合
- 默认值使用 `.default()`

### 请求体 Schema

定义 API 请求参数：

```typescript
export const loginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  encryptedPassword: z
    .string()
    .min(1, 'Password cannot be empty')
    .max(4096, 'Password data anomaly'),
  captchaId: z.string().min(1).optional(),
  captchaCode: z.string().min(1).optional(),
})
```

**规则**：
- 必填字段使用 `.min(1)` 或 `.email()` 等验证
- 添加自定义错误消息（中文）
- 敏感字段（如密码）设置合理的长度限制

### 响应体 Schema

定义 API 返回数据结构：

```typescript
export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  sessionId: z.string().optional(),
  user: userSchema,
})
```

**规则**：
- 嵌套实体使用已定义的 Schema
- 敏感字段（如 token）仅在必要时包含

### 查询参数 Schema

定义列表查询参数：

```typescript
export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
  pageSize: z.coerce.number().int().min(1).max(50).default(10).describe('每页条数'),
  search: z.string().optional().describe('邮箱模糊搜索'),
})
```

**规则**：
- 使用 `.coerce.number()` 自动转换字符串为数字
- 设置默认值和描述
- 添加范围限制（如 `.max(50)`）

---

## Schema 组合模式

### 分页响应工厂

使用工厂函数创建可复用的分页响应 Schema：

```typescript
export function createPagedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: paginationSchema,
  })
}

export const messageListResponseSchema = createPagedResponseSchema(messageSchema)
```

### 条件必填字段

使用 `.refine()` 实现条件必填逻辑：

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

### Schema 复用

使用 `.partial()` 创建更新请求 Schema：

```typescript
export const createCompanionSchema = z.object({
  name: z.string().min(1).max(100),
  headline: z.string().max(200).optional(),
  // ...
})

export const updateCompanionSchema = createCompanionSchema.partial()
```

### 类型转换

使用 `.transform()` 进行输入转换：

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

## 最佳实践

### 错误消息

- 错误消息使用**中文**
- 消息简洁明了，描述具体问题
- 避免技术术语，面向用户友好

```typescript
// 推荐
z.string().min(1, '文件名不能为空').max(255, '文件名过长')

// 避免
z.string().min(1).max(255)
```

### 枚举定义

将枚举提取为独立变量，便于复用：

```typescript
export const userRoleSchema = z.enum(['USER', 'ADMIN'])

export const userSchema = z.object({
  role: userRoleSchema.default('USER'),
})
```

### 日期字段

日期字段统一使用 `z.string()`，在业务层解析：

```typescript
export const conversationSummarySchema = z.object({
  text: z.string().max(1600),
  updatedAt: z.date(),
})
```

> 注意：`z.date()` 在 JSON 序列化时需要额外处理，通常使用 `z.string()` 配合 ISO 日期格式。

### Buffer 类型

对于 Node.js Buffer 类型，使用 `z.instanceof(Buffer)`：

```typescript
export const parserInputSchema = z.object({
  buffer: z.instanceof(Buffer).optional(),
  filePath: z.string().min(1).max(1024).optional(),
})
```

### 元数据字段

使用 `z.record(z.string(), z.unknown())` 保持通用性：

```typescript
export const parseResultSchema = z.object({
  content: z.string().min(1).max(5_000_000),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
```

---

## 复杂 Schema 示例

### Companion Pipeline Schema

`companion-pipeline.schema.ts` 展示了复杂业务流程的 Schema 定义：

```typescript
export const conversationSafetySchema = z.object({
  safetyLevel: z.enum(['safe', 'caution', 'redirect', 'block', 'crisis']),
  category: z.enum(['normal', 'emotional_dependency', 'manipulation', 'self_harm', 'other']),
  boundaryAction: z.enum(['continue', 'soft_boundary', 'redirect', 'refuse', 'crisis_support']),
  reason: z.string().trim().max(300),
  responseGuidance: z.string().trim().max(600),
  allowMemoryExtraction: z.boolean(),
})

export const fallbackSafety = {
  safetyLevel: 'caution' as const,
  category: 'other' as const,
  boundaryAction: 'soft_boundary' as const,
  reason: '安全边界判断暂时不可用，采用保守回复策略。',
  responseGuidance: '用温和、克制、尊重边界的方式回复。',
  allowMemoryExtraction: false,
}
```

**特点**：
- 每个节点定义独立的 Schema
- 提供 fallback 值确保管线不中断
- 使用 `as const` 确保类型安全

### Settings Schema

`settings.schema.ts` 展示了层级配置的 Schema 定义：

```typescript
export const settingsSchema = z.object({
  providers: z.record(z.string(), modelProviderSchema).default({}),
  chat: chatConfigSchema.default({ enabledProviders: [], temperature: 0.7 }),
  rag: ragConfigSchema.default({
    timeoutMs: 60_000,
    rerankerAllowedModelPrefixes: ['BAAI/', 'Xorbits/', 'sentence-transformers/'],
  }),
  companion: companionConfigSchema.default({}),
  indexing: indexingConfigSchema.default({
    contextualEmbedding: false,
    contextualWindow: 1,
    parentChunkSize: 800,
    childChunkSize: 150,
  }),
  appearance: appearanceConfigSchema.default({ mode: 'light', fontSizeLevel: 3 }),
})
```

**特点**：
- 分层配置结构
- 每个分类有独立的 Schema
- 默认值确保配置完整性

---

## 禁止模式

| 禁止 | 描述 | 正确做法 |
|------|------|----------|
| 内联复杂验证 | 在 Schema 中编写复杂逻辑 | 提取为独立函数 |
| 重复定义 Schema | 多个地方定义相同的结构 | 提取为共享 Schema |
| 省略错误消息 | `.min(1)` 不提供错误消息 | `.min(1, '错误消息')` |
| 使用 `any` 类型 | `z.any()` 绕过类型检查 | 使用明确类型或 `z.unknown()` |
| 硬编码默认值 | 在代码中硬编码默认值 | 使用 `.default()` |

---

## 常见错误

1. **忘记导出 Schema**：确保所有 Schema 在 `index.ts` 中导出
2. **类型推断不一致**：使用 `z.infer<typeof schema>` 派生类型
3. **可选字段处理不当**：区分 `.optional()`（不存在）和 `.nullable()`（存在但为 null）
4. **日期序列化问题**：JSON 中日期通常为字符串，使用 `z.string()` 而非 `z.date()`
5. **缺少长度限制**：字符串字段应设置合理的 `.max()` 限制