import { z } from 'zod'
import { createPagedResponseSchema, paginationSchema } from './common.schema.js'

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

export const messageListResponseSchema = createPagedResponseSchema(messageSchema)

export const sessionListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      userId: z.string().optional(),
      title: z.string(),
      provider: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
      messageCount: z.number(),
    }),
  ),
  pagination: paginationSchema,
})

export const providerListItemSchema = z.object({
  key: z.string(),
  name: z.string(),
  model: z.string(),
  isBuiltin: z.boolean(),
})

export const chatProvidersResponseSchema = z.object({
  providers: z.array(providerListItemSchema),
})

export const chatMessagesRequestSchema = z.object({
  response_mode: z.enum(['streaming', 'blocking']).default('streaming'),
  conversation_id: z.string().uuid().optional(),
  query: z.string().min(1, '输入不能为空').max(4000, '输入过长，最多 4000 字符'),
  inputs: z.record(z.unknown()).optional(),
  files: z.array(z.unknown()).optional(),
  parent_message_id: z.string().uuid().nullable().optional(),
  provider_key: z.string().optional(),
  model: z.string().optional(),
  knowledge_base_ids: z.array(z.string().uuid()).optional(),
})

export const chatMessagesChunkSchema = z.object({
  event: z.enum(['message', 'message_end', 'error']),
  conversation_id: z.string().uuid(),
  message_id: z.string().uuid(),
  answer: z.string(),
  done: z.boolean().optional(),
  error: z.string().optional(),
})

export const messageListQuerySchema = z.object({
  conversation_id: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
})
