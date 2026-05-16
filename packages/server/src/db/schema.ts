import { pgTable, uuid, text, timestamp, boolean, integer, bigint, type AnyPgColumn } from 'drizzle-orm/pg-core';

// ── users ───────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// ── knowledge_bases ─────────────────────────────────────
export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isPinned: boolean('is_pinned').default(false),
  sortOrder: integer('sort_order').default(0),
  icon: text('icon'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type KnowledgeBaseSelect = typeof knowledgeBases.$inferSelect;
export type KnowledgeBaseInsert = typeof knowledgeBases.$inferInsert;

// ── folders ─────────────────────────────────────────────
export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  kbId: uuid('kb_id')
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id')
    .references((): AnyPgColumn => folders.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type FolderSelect = typeof folders.$inferSelect;
export type FolderInsert = typeof folders.$inferInsert;

// ── documents ───────────────────────────────────────────
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  kbId: uuid('kb_id')
    .notNull()
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

export type DocumentSelect = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;

// ── chunks ──────────────────────────────────────────────
export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  kbId: uuid('kb_id')
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  chunkIndex: integer('chunk_index').notNull(),
  milvusId: text('milvus_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type ChunkSelect = typeof chunks.$inferSelect;
export type ChunkInsert = typeof chunks.$inferInsert;

// ── sessions ────────────────────────────────────────────
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').default('新对话'),
  provider: text('provider'),
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  messageCount: integer('message_count').default(0),
});

export type SessionSelect = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;

// ── messages ────────────────────────────────────────────
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').$type<'user' | 'assistant'>().notNull(),
  content: text('content').notNull(),
  knowledgeBaseIds: text('knowledge_base_ids').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type MessageSelect = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
