# 状态相关的 Schema 设计模式

> Data Schema 包中与状态管理相关的设计模式和最佳实践。

---

## 概述

`packages/data` 不包含状态管理库（如 Zustand），本指南描述的"状态管理"指的是**如何设计 Schema 来支持前后端的状态管理需求**，包括：

- 状态数据结构的 Schema 定义
- 配置状态的层级组织
- 业务流程状态的 Schema 设计
- 状态转换的验证规则

---

## 配置状态模式

### 分层配置 Schema

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

**设计原则**：

| 原则 | 说明 |
|------|------|
| **分类明确** | 按功能域划分（chat/rag/indexing/companion/appearance） |
| **默认值完整** | 每个分类都有合理的默认值 |
| **动态扩展** | 使用 `z.record()` 支持动态配置项 |
| **独立验证** | 每个分类有独立的 Schema 验证规则 |

### 配置分类 Schema

```typescript
export const chatConfigSchema = z.object({
  defaultProvider: z.string().min(1).optional(),
  enabledProviders: z.array(z.string()).default([]),
  temperature: z.number().min(0).max(2, 'temperature 范围 0-2').default(0.7),
})

export const ragConfigSchema = z.object({
  llmProvider: z.string().min(1).optional(),
  embeddingProvider: z.string().min(1).optional(),
  rerankerProvider: z.string().optional(),
  timeoutMs: z.number().min(1000).default(60_000),
})
```

---

## 业务流程状态模式

### LangGraph 管线状态

`companion-pipeline.schema.ts` 定义了完整的 LangGraph 工作流状态：

```typescript
export const conversationSafetySchema = z.object({
  safetyLevel: z.enum(['safe', 'caution', 'redirect', 'block', 'crisis']),
  category: z.enum(['normal', 'emotional_dependency', 'manipulation', 'self_harm', 'other']),
  boundaryAction: z.enum(['continue', 'soft_boundary', 'redirect', 'refuse', 'crisis_support']),
  reason: z.string().trim().max(300),
  responseGuidance: z.string().trim().max(600),
  allowMemoryExtraction: z.boolean(),
})

export const conversationIntentSchema = z.object({
  primary: companionIntentPrimarySchema,
  secondary: z.array(companionIntentPrimarySchema).max(3),
  confidence: z.number().min(0).max(1),
  userNeed: z.enum(['be_heard', 'be_comforted', 'get_advice', 'unknown']),
  // ...
})
```

**状态流转**：

```
safety → intent → emotion → relationship → route → policy → generate → quality → summary → memory_candidate → memory_extraction
```

### 状态回退机制

```typescript
export const fallbackSafety = {
  safetyLevel: 'caution' as const,
  category: 'other' as const,
  boundaryAction: 'soft_boundary' as const,
  reason: '安全边界判断暂时不可用，采用保守回复策略。',
  responseGuidance: '用温和、克制、尊重边界的方式回复。',
  allowMemoryExtraction: false,
}
```

**用途**：当某个状态节点计算失败时，使用 fallback 值确保管线不中断。

---

## 文档生命周期状态

### 文档状态机

```typescript
export const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kbId: z.string(),
  status: z.enum(['uploaded', 'chunking', 'embedding', 'indexing', 'ready', 'failed']),
  progress: z.number().min(0).max(100).optional(),
  error: z.string().optional(),
})
```

**状态转换**：

```
uploaded → chunking → embedding → indexing → ready
                    ↘         ↘          ↘
                     └─────────┴──────────→ failed
```

### 状态验证

使用 `.refine()` 验证状态转换的合法性：

```typescript
export const updateDocumentStatusSchema = z
  .object({
    status: z.enum(['uploaded', 'chunking', 'embedding', 'indexing', 'ready', 'failed']),
    progress: z.number().min(0).max(100).optional(),
    error: z.string().optional(),
  })
  .refine(({ status, error }) => {
    if (status === 'failed') {
      return error !== undefined && error.length > 0
    }
    return true
  }, { message: 'failed 状态必须提供 error 信息', path: ['error'] })
```

---

## 会话状态模式

### 消息状态

```typescript
export const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string(),
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

### 会话状态

```typescript
export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  title: z.string(),
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number(),
})
```

---

## 用户状态模式

### 用户角色状态

```typescript
export const userRoleSchema = z.enum(['USER', 'ADMIN'])

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: userRoleSchema.default('USER'),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
```

### 管理用户状态

```typescript
export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['ADMIN', 'USER']),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
```

**状态字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `role` | enum | 用户角色（USER/ADMIN） |
| `isActive` | boolean | 用户是否启用 |

---

## 流式响应状态

### SSE 事件状态

```typescript
export const chatMessagesChunkSchema = z.object({
  event: z.enum(['message', 'message_end', 'error']),
  conversation_id: z.string().uuid(),
  message_id: z.string().uuid(),
  answer: z.string(),
  done: z.boolean().optional(),
  error: z.string().optional(),
})
```

**事件类型**：

| 事件 | 说明 |
|------|------|
| `message` | 增量消息内容 |
| `message_end` | 消息结束 |
| `error` | 错误发生 |

---

## 最佳实践

### 状态字段命名

使用明确的状态字段名：

```typescript
// 推荐
status: z.enum(['uploaded', 'chunking', 'embedding', 'indexing', 'ready', 'failed'])

// 避免
state: z.enum(['u', 'c', 'e', 'i', 'r', 'f'])
```

### 状态转换验证

使用 `.refine()` 确保状态转换的合法性：

```typescript
export const updateDocumentStatusSchema = z
  .object({
    status: z.enum(['uploaded', 'chunking', 'embedding', 'indexing', 'ready', 'failed']),
    previousStatus: z.enum(['uploaded', 'chunking', 'embedding', 'indexing', 'ready', 'failed']),
  })
  .refine(({ status, previousStatus }) => {
    const validTransitions: Record<string, string[]> = {
      uploaded: ['chunking'],
      chunking: ['embedding', 'failed'],
      embedding: ['indexing', 'failed'],
      indexing: ['ready', 'failed'],
      ready: [],
      failed: ['uploaded'],
    }
    return validTransitions[previousStatus]?.includes(status) ?? false
  }, { message: '无效的状态转换', path: ['status'] })
```

### 默认状态设置

为状态字段设置合理的默认值：

```typescript
export const userSchema = z.object({
  role: userRoleSchema.default('USER'),
})

export const settingsSchema = z.object({
  appearance: appearanceConfigSchema.default({ mode: 'light', fontSizeLevel: 3 }),
})
```

### 状态相关常量

将状态相关的常量与 Schema 放在一起：

```typescript
export const DOCUMENT_STATUSES = ['uploaded', 'chunking', 'embedding', 'indexing', 'ready', 'failed'] as const
export const DOCUMENT_STATUS_SCHEMA = z.enum(DOCUMENT_STATUSES)
```

---

## 禁止模式

| 禁止 | 描述 | 正确做法 |
|------|------|----------|
| 使用数字编码状态 | `status: z.number()` | 使用 `z.enum()` 枚举 |
| 状态字段过多 | 一个 Schema 中有多个状态字段 | 拆分为独立的状态 Schema |
| 缺失状态回退 | 没有 fallback 值 | 提供合理的 fallback |
| 状态转换无验证 | 允许任意状态转换 | 使用 `.refine()` 验证 |
| 状态字段命名模糊 | `type`, `kind`, `mode` | 使用 `status`, `role`, `phase` |

---

## 常见错误

1. **状态枚举值不一致**：不同 Schema 中使用不同的状态值
2. **状态字段缺少默认值**：导致未初始化时状态为 `undefined`
3. **状态转换缺少验证**：允许非法的状态转换
4. **流式响应缺少事件类型**：无法区分不同类型的 SSE 事件
5. **配置状态缺少默认值**：导致配置读取失败