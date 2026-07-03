# 目录结构

> Data Schema 包的组织方式。

---

## 概述

`packages/data` 是一个**纯 TypeScript Schema 包**，不包含任何运行时代码，仅提供 Zod Schema 和 TypeScript 类型定义。它作为**前后端共享的契约层**，确保数据验证和类型安全的一致性。

---

## 目录布局

```
packages/data/
├── src/
│   ├── schemas/              # Zod Schema 定义（核心）
│   │   ├── admin.schema.ts           # 管理用户相关 Schema
│   │   ├── audit.schema.ts           # 审计日志相关 Schema
│   │   ├── auth.schema.ts            # 认证相关 Schema（登录/注册/用户）
│   │   ├── chat.schema.ts            # 聊天消息/会话/提供商 Schema
│   │   ├── common.schema.ts          # 通用 Schema（分页、工具函数）
│   │   ├── companion.schema.ts       # 伴侣 CRUD Schema
│   │   ├── companion-pipeline.schema.ts # LangGraph 管线 Schema（安全/意图/情感等）
│   │   ├── dashboard.schema.ts       # 仪表盘数据 Schema
│   │   ├── document.schema.ts        # 文档 CRUD Schema
│   │   ├── folder.schema.ts          # 文件夹 CRUD Schema
│   │   ├── index.ts                  # 统一导出入口
│   │   ├── kb.schema.ts              # 知识库 CRUD Schema
│   │   ├── model.schema.ts           # 模型提供商配置 Schema
│   │   ├── rag.schema.ts             # RAG 解析/索引相关 Schema
│   │   ├── session.schema.ts         # 会话 CRUD Schema
│   │   └── settings.schema.ts        # 设置分类 Schema（chat/rag/indexing/companion/appearance）
│   └── types/                # 派生 TypeScript 类型（可选）
│       ├── chat.ts                   # 聊天相关类型导出
│       └── index.ts                  # 类型统一导出
├── package.json              # 包配置（zod ^3.23.0）
└── tsconfig.json             # TypeScript 配置（strict: true）
```

---

## 模块组织

### Schema 命名规范

| 命名模式 | 说明 | 示例 |
|---------|------|------|
| `{entity}Schema` | 实体数据结构 | `userSchema`, `messageSchema`, `documentSchema` |
| `{action}{Entity}RequestSchema` | 请求体 Schema | `createKbRequestSchema`, `updateDocumentRequestSchema` |
| `{entity}ListResponseSchema` | 列表响应 Schema | `kbListResponseSchema`, `messageListResponseSchema` |
| `{entity}QuerySchema` | 查询参数 Schema | `adminUserListQuerySchema`, `companionListQuerySchema` |

### 功能分类

| 分类 | Schema 文件 | 职责 |
|------|------------|------|
| **认证** | `auth.schema.ts` | 登录/注册/用户信息/公钥响应 |
| **聊天** | `chat.schema.ts`, `session.schema.ts` | 消息、会话、提供商配置 |
| **知识库** | `kb.schema.ts`, `document.schema.ts`, `folder.schema.ts` | 知识库、文档、文件夹 CRUD |
| **伴侣** | `companion.schema.ts`, `companion-pipeline.schema.ts` | 伴侣 CRUD + LangGraph 管线状态 |
| **管理** | `admin.schema.ts`, `audit.schema.ts`, `model.schema.ts` | 管理后台数据结构 |
| **RAG** | `rag.schema.ts` | 解析器输入/输出、索引选项/结果 |
| **设置** | `settings.schema.ts` | 分类设置（chat/rag/indexing/companion/appearance） |
| **通用** | `common.schema.ts` | 分页工具、共享函数 |

---

## 命名约定

### 文件命名

- 使用小写蛇形命名：`auth.schema.ts`、`kb.schema.ts`
- 每个 Schema 文件对应一个业务域
- 复杂域可拆分为多个文件（如 `companion.schema.ts` + `companion-pipeline.schema.ts`）

### Schema 命名

- 基础实体：`{entity}Schema`（如 `userSchema`）
- 请求体：`{action}{Entity}RequestSchema`（如 `createKbRequestSchema`）
- 响应体：`{entity}ResponseSchema` 或 `{entity}ListResponseSchema`
- 查询参数：`{entity}QuerySchema` 或 `{entity}ListQuerySchema`
- 枚举：`{enumName}Schema`（如 `userRoleSchema`）

### 类型导出

- 使用 `z.infer<typeof schema>` 从 Schema 派生 TypeScript 类型
- 类型名使用 PascalCase（如 `User`, `ChatMessagesRequest`）
- 类型统一导出到 `types/` 目录或直接在 Schema 文件中导出

---

## 示例

### 良好组织的 Schema 文件

`chat.schema.ts` 展示了典型的 Schema 文件结构：

```typescript
import { z } from 'zod'
import { createPagedResponseSchema, paginationSchema } from './common.schema.js'

// 基础实体 Schema
export const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string(),
})

// 分页响应 Schema
export const messageListResponseSchema = createPagedResponseSchema(messageSchema)

// 请求体 Schema
export const chatMessagesRequestSchema = z.object({
  query: z.string().min(1, '输入不能为空').max(4000, '输入过长'),
  provider_key: z.string().optional(),
})

// 流式响应 Schema
export const chatMessagesChunkSchema = z.object({
  event: z.enum(['message', 'message_end', 'error']),
  answer: z.string(),
})
```

### 导出模式

`schemas/index.ts` 统一导出所有 Schema，分为请求和响应两类：

```typescript
export {
  authResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  userSchema,
} from './auth.schema.js'

export {
  messageSchema,
  chatMessagesRequestSchema,
  chatMessagesChunkSchema,
} from './chat.schema.js'
```

---

## 新增 Schema 的流程

1. 在 `src/schemas/` 下创建新文件：`{domain}.schema.ts`
2. 定义请求/响应/实体 Schema
3. 在 `src/schemas/index.ts` 中导出新 Schema
4. 如需导出 TypeScript 类型，在 `src/types/` 中添加类型声明
5. 运行 `pnpm --filter @goferbot/data build` 验证构建