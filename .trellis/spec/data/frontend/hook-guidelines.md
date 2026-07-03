# 工具函数和组合模式

> Data Schema 包中可复用工具函数和组合模式的设计规范。

---

## 概述

`packages/data` 不包含 React Hooks，本指南描述的"hooks"指的是**可复用的工具函数、工厂函数和组合模式**，用于构建和操作 Zod Schema。

---

## 核心工具函数

### 分页响应工厂

```typescript
export function createPagedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: paginationSchema,
  })
}
```

**用途**：快速创建分页列表响应 Schema，避免重复代码。

**使用方式**：

```typescript
export const messageListResponseSchema = createPagedResponseSchema(messageSchema)
export const kbListResponseSchema = createPagedResponseSchema(kbEntrySchema)
```

### 条件验证辅助函数

```typescript
export const atLeastOneRequired = <T extends z.ZodTypeAny>(
  schema: T,
  fields: string[],
  message: string,
  path?: string[],
) => {
  return schema.refine(
    (data: unknown) => {
      const obj = data as Record<string, unknown>
      return fields.some((field) => obj[field] !== undefined && obj[field] !== null)
    },
    { message, path: path || fields },
  )
}
```

**用途**：实现多个字段中至少一个必填的验证逻辑。

---

## 组合模式

### Schema 复用模式

#### 创建与更新复用

```typescript
export const createCompanionSchema = z.object({
  name: z.string().min(1).max(100),
  headline: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
})

export const updateCompanionSchema = createCompanionSchema.partial()
```

**规则**：
- 创建 Schema 定义完整字段
- 更新 Schema 使用 `.partial()` 使所有字段可选
- 如果更新有特殊限制，手动定义而非使用 `.partial()`

#### 请求与响应复用

```typescript
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
})

export const createUserRequestSchema = userSchema.omit({ id: true })
export const updateUserRequestSchema = createUserRequestSchema.partial()
```

---

### 条件必填模式

使用 `.refine()` 实现复杂的条件验证：

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

**规则**：
- 使用 `.refine()` 添加自定义验证逻辑
- 指定 `path` 参数定位错误字段
- 提供清晰的中文错误消息

---

### 类型转换模式

#### 查询参数转换

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

**用途**：处理 URL 查询参数中布尔值的多种表示形式（`true`/`'true'`/`1`/`'1'`）。

#### 数字强制转换

```typescript
export const messageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
})
```

**用途**：URL 查询参数通常为字符串，使用 `.coerce.number()` 自动转换。

---

### 嵌套 Schema 模式

#### 层级配置

```typescript
export const settingsSchema = z.object({
  providers: z.record(z.string(), modelProviderSchema).default({}),
  chat: chatConfigSchema.default({ enabledProviders: [], temperature: 0.7 }),
  rag: ragConfigSchema.default({ timeoutMs: 60_000 }),
  companion: companionConfigSchema.default({}),
  indexing: indexingConfigSchema.default({}),
  appearance: appearanceConfigSchema.default({ mode: 'light', fontSizeLevel: 3 }),
})
```

**特点**：
- 每个分类有独立的 Schema
- 使用 `.default()` 设置默认值
- 使用 `z.record()` 处理动态键值对

#### 复杂对象数组

```typescript
export const chatMessagesRequestSchema = z.object({
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
```

---

## Fallback 值模式

### 管线安全回退

```typescript
export const fallbackSafety = {
  safetyLevel: 'caution' as const,
  category: 'other' as const,
  boundaryAction: 'soft_boundary' as const,
  reason: '安全边界判断暂时不可用，采用保守回复策略。',
  responseGuidance: '用温和、克制、尊重边界的方式回复。',
  allowMemoryExtraction: false,
}

export const fallbackIntent = {
  primary: 'unclear' as const,
  secondary: [],
  confidence: 0.3,
  userNeed: 'unknown' as const,
  // ...
}
```

**用途**：LangGraph 管线中，当某个节点失败时使用 fallback 值确保管线不中断。

**规则**：
- fallback 值必须满足对应 Schema 的类型约束
- 使用 `as const` 确保类型安全
- 提供合理的保守默认值

---

## 常量导出模式

### 业务常量

```typescript
export const MEMORY_INJECTION_LIMIT = 12
export const MEMORY_EXTRACTION_LIMIT = 2
export const MESSAGE_FEEDBACK_INJECTION_LIMIT = 8
export const RECENT_MESSAGE_LIMIT = 18
export const INITIAL_HISTORY_LIMIT = 40
```

### 正则表达式

```typescript
export const MEMORY_KEYWORD_REGEX = /记住|以后|别再|我喜欢|我不喜欢|我的习惯|我的边界/i
```

**规则**：
- 常量使用全大写蛇形命名
- 常量与相关 Schema 放在同一文件中
- 避免魔法数字，使用具名常量

---

## 派生类型模式

### 从 Schema 派生类型

```typescript
export type CodeBlock = z.infer<typeof codeBlockSchema>
export type SectionBlock = z.infer<typeof sectionBlockSchema>
export type ParserInput = z.infer<typeof parserInputSchema>
```

**规则**：
- 使用 `z.infer<typeof schema>` 派生类型
- 类型名使用 PascalCase
- 类型导出到 `types/` 目录或直接在 Schema 文件中导出

### 类型映射

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

**用途**：创建类型安全的配置映射。

---

## 命名冲突处理

### 别名导出

```typescript
export {
  messageListQuerySchema as companionMessageListQuerySchema,
} from './companion.schema.js'
```

**用途**：当多个模块导出同名 Schema 时，使用别名避免冲突。

### 兼容旧命名

```typescript
export const providerSchema = modelProviderSchema
export const embeddingProviderSchema = modelProviderSchema
```

**用途**：保持向后兼容性，逐步迁移后可删除。

---

## 最佳实践

### 函数单一职责

每个工具函数只做一件事：

```typescript
// 推荐
function toBoolean(value: unknown): boolean | undefined {
  // 只处理布尔值转换
}

// 避免
function parseQueryParams(params: unknown) {
  // 同时处理多种类型转换
}
```

### 参数类型安全

工具函数的参数应有明确类型：

```typescript
function atLeastOneRequired<T extends z.ZodTypeAny>(
  schema: T,
  fields: string[],
  message: string,
  path?: string[],
) {
  // ...
}
```

### 错误消息本地化

错误消息使用中文，便于前后端统一展示：

```typescript
z.string().min(1, '文件名不能为空').max(255, '文件名过长')
```

### 避免过度泛化

不要创建过于通用的工具函数，保持针对性：

```typescript
// 推荐
function createPagedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({ items: z.array(itemSchema), pagination: paginationSchema })
}

// 避免（过于复杂）
function createResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  options?: { includePagination?: boolean; includeMeta?: boolean },
) {
  // ...
}
```

---

## 常见错误

1. **忘记导出工具函数**：确保工具函数在 `index.ts` 中导出
2. **类型转换后缺少验证**：转换后应继续添加 `.min()`/`.max()` 等验证
3. **refine 逻辑过于复杂**：复杂逻辑应提取为独立函数
4. **fallback 值类型不匹配**：fallback 值必须满足 Schema 约束
5. **重复定义工具函数**：检查 `common.schema.ts` 中是否已有类似函数