# 云原生架构重构设计文档

> 日期：2026-05-15
> 状态：设计中

---

## 1. 项目定位

带本地能力的 AI Workspace / Agent OS

- 云端优先
- 本地缓存
- 可扩展 SaaS
- AI Native Infrastructure

---

## 2. 技术栈

### 前端

| 模块 | 技术 |
|------|------|
| App Shell | Tauri v2 |
| 框架 | Vue 3 + TypeScript |
| 状态管理 | Pinia |
| UI | shadcn-vue + Tailwind CSS v4 |
| 图标 | lucide-vue-next |
| 本地缓存 | SQLite（UI 状态、离线数据） |

### 后端

| 模块 | 技术 |
|------|------|
| API Gateway | Hono |
| ORM | Drizzle ORM |
| 数据库 | PostgreSQL 16 (Docker) |
| 对象存储 | MinIO (Docker) |
| 向量数据库 | Milvus 2.4+ (Docker) |
| 缓存/队列 | Redis 7 (Docker) + BullMQ |
| 认证 | Better Auth |
| 文件解析 | LangChain Document Loaders |
| 分块 | LangChain Text Splitters |

---

## 3. 系统架构

```
┌──────────────────┐
│   Tauri Client   │
│    Vue UI        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Hono Gateway   │
└────────┬─────────┘
         │
    ┌────┴────┬─────────────┐
    │         │             │
    ▼         ▼             ▼
┌────────┐ ┌────────┐  ┌──────────┐
│PostgreSQL│ │ Milvus │  │  MinIO   │
└────────┘ └────────┘  └──────────┘
    │
    ▼
┌────────┐
│ Redis  │──→ BullMQ Workers
└────────┘    (parse / chunk / embed)
```

---

## 4. 数据库设计（PostgreSQL + Drizzle ORM）

### 4.1 users

```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

### 4.2 knowledge_bases

```typescript
export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  isPinned: boolean('is_pinned').default(false),
  sortOrder: integer('sort_order').default(0),
  icon: text('icon'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
```

### 4.3 folders（虚拟文件夹）

```typescript
export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  kbId: uuid('kb_id').references(() => knowledgeBases.id),
  parentId: uuid('parent_id'), // 自引用，null = 根目录
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

### 4.4 documents

```typescript
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  kbId: uuid('kb_id').references(() => knowledgeBases.id),
  folderId: uuid('folder_id').references(() => folders.id),
  name: text('name').notNull(),
  ext: text('ext'),           // 扩展名
  mimeType: text('mime_type'),
  size: bigint('size', { mode: 'number' }),
  storageKey: text('storage_key').notNull(), // MinIO key
  hash: text('hash'),         // 文件哈希，用于去重
  status: text('status').default('uploaded'), // uploaded | parsing | chunking | indexing | ready | failed
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
```

### 4.5 chunks

```typescript
export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id),
  kbId: uuid('kb_id').references(() => knowledgeBases.id),
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  chunkIndex: integer('chunk_index').notNull(),
  milvusId: text('milvus_id'), // 对应 Milvus 中的主键
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

### 4.6 sessions

```typescript
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  title: text('title').default('新对话'),
  provider: text('provider'),
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  messageCount: integer('message_count').default(0),
})
```

### 4.7 messages

```typescript
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id),
  role: text('role').$type<'user' | 'assistant'>().notNull(),
  content: text('content').notNull(),
  knowledgeBaseIds: text('knowledge_base_ids').array(), // PostgreSQL array
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

---

## 5. 对象存储设计（MinIO）

### Bucket: `documents`

Storage Key 格式：

```
users/<user-id>/kb/<kb-id>/<doc-id>_<filename>
```

示例：

```
users/550e8400-e29b-41d4-a716-446655440000/kb/7c9e6679-7425-40de-944b-e07fc1f90ae7/doc-123_报告.pdf
```

### 上传流程（MVP 简化版）

```
Client → Hono (multipart/form-data) → MinIO
              ↓
         创建 document 记录
              ↓
         加入 BullMQ 队列
```

后续优化为 Presigned URL：

```
Client → Hono (请求上传 URL) ← MinIO Presigned URL
Client → MinIO (直接上传)
Client → Hono (上传完成回调)
```

---

## 6. Milvus 设计

### Collection: `knowledge_chunks`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR | Milvus 主键 |
| chunk_id | VARCHAR | 关联 PostgreSQL chunks.id |
| kb_id | VARCHAR | 知识库 ID |
| file_id | VARCHAR | 文件 ID |
| embedding | FLOAT_VECTOR(1536) | 向量 |

### 检索流程

```
Query → Embedding → Milvus ANN Search (with kb_id filter)
                           ↓
                    返回 chunk_ids
                           ↓
              PostgreSQL 查询 chunk 内容
                           ↓
                    Rerank → LLM
```

---

## 7. 异步任务流水线（BullMQ）

### 队列：`document-processing`

```
uploaded
    ↓
[Job: parse] ──→ parsing ──→ 提取文本
    ↓
[Job: chunk] ──→ chunking ──→ 文本分块
    ↓
[Job: embed] ──→ indexing ──→ 生成向量 → Milvus
    ↓
  ready
```

失败时：status = `failed`，errorMessage 记录原因。

### Worker 实现

```typescript
// workers/parser.worker.ts
import { Worker } from 'bullmq'

const parserWorker = new Worker('document-processing', async (job) => {
  if (job.name === 'parse') {
    // 1. 从 MinIO 下载文件
    // 2. 用 LangChain loader 解析
    // 3. 更新 document.status = 'chunking'
    // 4. 添加 chunk job
  }
}, { connection: redis })
```

---

## 8. 认证设计（Better Auth）

### MVP 范围

- 简单邮箱 + 密码注册/登录
- Session Cookie
- 无 OAuth、无邮箱验证（后续扩展）

### API 集成

```typescript
// server/src/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

export const auth = betterAuth({
  database: drizzleAdapter(db),
  emailAndPassword: {
    enabled: true,
  },
})

// Hono 挂载
app.on(['POST', 'GET'], '/api/auth/**', (c) => auth.handler(c.req.raw))
```

### 前端集成

```typescript
import { createAuthClient } from 'better-auth/client'

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3000',
})

// 登录
await authClient.signIn.email({ email, password })

// 获取当前用户
const { data: session } = await authClient.getSession()
```

---

## 9. RAG SDK 预留接口

`packages/rag-sdk/` 保持最小结构，预留以下接口：

```typescript
// packages/rag-sdk/src/index.ts

export interface IndexingOptions {
  documentId: string
  kbId: string
  storageKey: string
  mimeType: string
}

export interface SearchOptions {
  query: string
  kbIds: string[]
  topK?: number
}

export interface SearchResult {
  chunkId: string
  content: string
  score: number
  metadata: Record<string, any>
}

// 预留：后续实现
export async function runIndexingPipeline(options: IndexingOptions): Promise<void> {
  throw new Error('Not implemented: runIndexingPipeline')
}

export async function runRagPipeline(options: SearchOptions): Promise<SearchResult[]> {
  throw new Error('Not implemented: runRagPipeline')
}
```

后端在 `services/indexer.ts` 中调用预留接口，当前先简单更新 `status = 'ready'`。

---

## 10. 前端调整

### 新增页面/组件

- **登录页**：邮箱 + 密码表单
- **注册页**：邮箱 + 密码 + 确认密码
- **文档状态标签**：上传中 / 解析中 / 索引中 / 就绪 / 失败
- **多知识库选择**：聊天时支持选择多个知识库（复选框）

### 状态管理更新

```typescript
// stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoggedIn = computed(() => !!user.value)

  async function signIn(email: string, password: string) { ... }
  async function signUp(email: string, password: string) { ... }
  async function signOut() { ... }

  return { user, isLoggedIn, signIn, signUp, signOut }
})
```

---

## 11. Docker Compose 配置

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kb
      POSTGRES_PASSWORD: kb_password
      POSTGRES_DB: knowledge_base
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  milvus-standalone:
    image: milvusdb/milvus:v2.4.1
    command: ["milvus", "run", "standalone"]
    ports:
      - "19530:19530"
      - "9091:9091"
    volumes:
      - milvus_data:/var/lib/milvus

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  pg_data:
  minio_data:
  milvus_data:
  redis_data:
```

---

## 12. 实施优先级

### Phase 1: 基础设施（P0）

- [ ] Docker Compose 配置（PG + MinIO + Milvus + Redis）
- [ ] Drizzle ORM 配置 + 数据库迁移
- [ ] MinIO Client 封装
- [ ] Milvus Client 封装
- [ ] Redis + BullMQ 配置

### Phase 2: 认证系统（P0）

- [ ] Better Auth 集成
- [ ] 登录/注册 API
- [ ] 前端登录/注册页面
- [ ] 路由守卫（未登录跳转）

### Phase 3: 知识库与文件（P0）

- [ ] 知识库 CRUD（PostgreSQL）
- [ ] 虚拟文件夹 CRUD
- [ ] 文件上传 → MinIO
- [ ] 文件列表/删除/移动
- [ ] 文档状态机（status 字段）
- [ ] 异步流水线框架（BullMQ + Worker 占位）

### Phase 4: 聊天功能（P0）

- [ ] 会话 CRUD（PostgreSQL）
- [ ] 消息存储
- [ ] SSE 流式对话
- [ ] 多知识库选择 UI
- [ ] RAG 预留接口（先返回空）

### Phase 5: RAG 集成（P1）

- [ ] SDK 实现：解析 → 分块 → 向量化
- [ ] Milvus 写入与检索
- [ ] 混合检索（向量 + 关键词）
- [ ] Rerank

### Phase 6: 优化（P2）

- [ ] Presigned URL 上传
- [ ] 文件预览（PDF/图片/Markdown）
- [ ] 本地 SQLite 缓存层
- [ ] 离线模式支持

---

## 13. 本地 SQLite 缓存层（预留）

前端本地缓存用途：

- 最近打开文件列表
- UI 状态（侧边栏展开、主题等）
- 离线时的草稿消息
- 本地 Agent Memory（后续）

实现：

```typescript
// packages/webui/src/db/cache.ts
import { openDB } from 'idb'

const cacheDB = openDB('kb-cache', 1, {
  upgrade(db) {
    db.createObjectStore('recent-files', { keyPath: 'id' })
    db.createObjectStore('ui-state', { keyPath: 'key' })
    db.createObjectStore('drafts', { keyPath: 'sessionId' })
  },
})
```

---

*文档结束*
