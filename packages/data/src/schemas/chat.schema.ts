import { z } from 'zod'
import { paginationSchema } from './common.schema.js'

export const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string(),
  files: z.array(z.object({
    id: z.string(),
    fileName: z.string(),
    fileUrl: z.string(),
  })).optional(),
})

export const streamChatRequestSchema = z.object({
  input: z.string().min(1, '输入不能为空').max(4000, '输入过长，最多 4000 字符'),
  sessionId: z.string().uuid('sessionId 格式不正确'),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),
  lastMessageId: z.string().uuid().optional(),
  providerKey: z.string().optional(),
})

export const sendMessageRequestSchema = z.object({
  sessionId: z.string(),
  content: z.string(),
  fileIds: z.array(z.string()).optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),
})

export const messageListResponseSchema = z.object({
  limit: z.number(),
  has_more: z.boolean(),
  data: z.array(messageSchema),
})

export const sessionListResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    userId: z.string().optional(),
    title: z.string(),
    provider: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    messageCount: z.number(),
  })),
  pagination: paginationSchema,
})

export const providerListItemSchema = z.object({
  key: z.string(),
  name: z.string(),
  model: z.string(),
  isBuiltin: z.boolean(),
})

export const chatInitResponseSchema = z.object({
  providers: z.array(providerListItemSchema),
  knowledgeBases: z.array(z.unknown()),
})

export const chatProvidersResponseSchema = z.object({
  providers: z.array(providerListItemSchema),
})

export const chatMessagesRequestSchema = z.object({
  response_mode: z.literal('streaming'),
  conversation_id: z.string().uuid().optional(),
  query: z.string().min(1, '输入不能为空').max(4000, '输入过长，最多 4000 字符'),
  inputs: z.record(z.unknown()).optional(),
  files: z.array(z.unknown()).optional(),
  parent_message_id: z.string().uuid().nullable().optional(),
  knowledge_base_ids: z.array(z.string().uuid()).optional(),
  provider_key: z.string().optional(),
  model: z.string().optional(),
})

export const chatMessagesChunkSchema = z.object({
  event: z.literal('message'),
  conversation_id: z.string().uuid(),
  message_id: z.string().uuid(),
  answer: z.string(),
  done: z.boolean().optional(),
  error: z.string().optional(),
})

export const messageListQuerySchema = z.object({
  conversation_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  last_id: z.string().uuid().optional(),
})