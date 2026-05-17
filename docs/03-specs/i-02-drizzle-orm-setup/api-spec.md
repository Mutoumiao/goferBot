---
issue_id: i-02-drizzle-orm-setup
type: api-spec
status: draft
summary: 基础设施层（无 HTTP API），定义 7 张 PostgreSQL 表 Schema（users/knowledge_bases/folders/documents/chunks/sessions/messages）类型及 db 实例导出接口。
---
# API Spec: Drizzle ORM Setup

> 本任务为基础设施层，无 HTTP API。本文档定义数据库 Schema 类型与导出接口。

## 1. Schema 文件路径

```
packages/server/src/db/schema.ts
```

## 2. 表定义

### 2.1 users

```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

**约束**：
- `email`：`NOT NULL`，`UNIQUE`
- `createdAt`：默认 `now()`

**导出类型**：
```typescript
export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
```

---

### 2.2 knowledge_bases

```typescript
export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isPinned: boolean('is_pinned').default(false),
  sortOrder: integer('sort_order').default(0),
  icon: text('icon'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

**约束**：
- `user_id`：外键 → `users.id`，级联删除
- `name`：`NOT NULL`
- `is_pinned`：默认 `false`
- `sort_order`：默认 `0`

**导出类型**：
```typescript
export type KnowledgeBaseSelect = typeof knowledgeBases.$inferSelect;
export type KnowledgeBaseInsert = typeof knowledgeBases.$inferInsert;
```

---

### 2.3 folders

```typescript
export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  kbId: uuid('kb_id')
    .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id')
    .references(() => folders.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

**约束**：
- `kb_id`：外键 → `knowledge_bases.id`，级联删除
- `parent_id`：外键 → `folders.id`（自引用），级联删除；可为 `null`（根目录）
- `name`：`NOT NULL`

**导出类型**：
```typescript
export type FolderSelect = typeof folders.$inferSelect;
export type FolderInsert = typeof folders.$inferInsert;
```

---

### 2.4 documents

```typescript
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  kbId: uuid('kb_id')
    .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  folderId: uuid('folder_id')
    .references(() => folders.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ext: text('ext'),
  mimeType: text('mime_type'),
  size: bigint('size', { mode: 'number' }),
  storageKey: text('storage_key').notNull(),
  hash: text('hash'),
  status: text('status').default('uploaded'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

**约束**：
- `kb_id`：外键 → `knowledge_bases.id`，级联删除
- `folder_id`：外键 → `folders.id`，级联删除；可为 `null`
- `name`：`NOT NULL`
- `storage_key`：`NOT NULL`
- `status`：默认 `'uploaded'`，业务层约束取值：
  `uploaded | parsing | chunking | indexing | ready | failed`

**导出类型**：
```typescript
export type DocumentSelect = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;
```

---

### 2.5 chunks

```typescript
export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .references(() => documents.id, { onDelete: 'cascade' }),
  kbId: uuid('kb_id')
    .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  chunkIndex: integer('chunk_index').notNull(),
  milvusId: text('milvus_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

**约束**：
- `document_id`：外键 → `documents.id`，级联删除
- `kb_id`：外键 → `knowledge_bases.id`，级联删除
- `content`：`NOT NULL`
- `chunk_index`：`NOT NULL`
- **不存储 embedding 向量**（向量存于 Milvus）

**导出类型**：
```typescript
export type ChunkSelect = typeof chunks.$inferSelect;
export type ChunkInsert = typeof chunks.$inferInsert;
```

---

### 2.6 sessions

```typescript
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').default('新对话'),
  provider: text('provider'),
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  messageCount: integer('message_count').default(0),
});
```

**约束**：
- `user_id`：外键 → `users.id`，级联删除
- `title`：默认 `'新对话'`
- `message_count`：默认 `0`

**导出类型**：
```typescript
export type SessionSelect = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;
```

---

### 2.7 messages

```typescript
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').$type<'user' | 'assistant'>().notNull(),
  content: text('content').notNull(),
  knowledgeBaseIds: text('knowledge_base_ids').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

**约束**：
- `session_id`：外键 → `sessions.id`，级联删除
- `role`：`NOT NULL`，业务层约束为 `'user' | 'assistant'`
- `content`：`NOT NULL`
- `knowledge_base_ids`：PostgreSQL `text[]` 数组类型，可为 `null`

**导出类型**：
```typescript
export type MessageSelect = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
```

## 3. 类型与 IRepository 对齐

所有 `Select` 类型均满足 `IRepository<T>` 的泛型约束：

```typescript
// 验证示例（编译时检查）
const _userRepo: IRepository<UserSelect> = {} as any;
const _kbRepo: IRepository<KnowledgeBaseSelect> = {} as any;
const _docRepo: IRepository<DocumentSelect> = {} as any;
```

## 4. 导出汇总（packages/server/src/db/index.ts）

```typescript
// db 实例
export { db } from './client';

// Schema 表定义
export * from './schema';

// Drizzle ORM 工具
export { eq, and, or, inArray, desc, asc } from 'drizzle-orm';
```

## 5. drizzle.config.ts 配置

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## 6. package.json scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```
