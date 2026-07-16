import { z } from 'zod'
import { createPagedResponseSchema, paginationSchema } from './common.schema.js'

/** Chat knowledge Q&A source citation (multi-KB: kb_id required). */
export const chatSourceItemSchema = z.object({
  kb_id: z.string().uuid(),
  document_id: z.string().uuid(),
  chunk_id: z.string().uuid().nullable().optional(),
  content: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
})

export const messageMetadataSchema = z
  .object({
    sources: z.array(chatSourceItemSchema).optional(),
    retrieval_empty: z.boolean().optional(),
    /** 管线降级（如检索依赖不可用仍生成回复） */
    degraded: z.boolean().optional(),
    /** 端到端延迟（ms），可选埋点 */
    latencyMs: z.number().nonnegative().optional(),
    error: z.string().optional(),
  })
  .passthrough()

export const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string(),
  status: z.enum(['streaming', 'completed', 'cancelled', 'failed']).optional(),
  metadata: messageMetadataSchema.nullable().optional(),
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
  /** Phase 1: Chat = knowledge Q&A; at least one KB is required. */
  knowledge_base_ids: z.array(z.string().uuid()).min(1, '至少选择一个知识库'),
  retrieval_mode: z.enum(['strict', 'loose']).optional().default('strict'),
})

export const chatMessagesChunkSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('sources'),
    conversation_id: z.string().uuid(),
    message_id: z.string().uuid(),
    sources: z.array(chatSourceItemSchema),
    retrieval_empty: z.boolean().optional(),
    done: z.boolean().optional(),
  }),
  z.object({
    event: z.literal('message'),
    conversation_id: z.string().uuid(),
    message_id: z.string().uuid(),
    answer: z.string(),
    done: z.boolean().optional(),
  }),
  z.object({
    event: z.literal('message_end'),
    conversation_id: z.string().uuid(),
    message_id: z.string().uuid(),
    answer: z.string().optional().default(''),
    done: z.boolean().optional(),
    retrieval_empty: z.boolean().optional(),
  }),
  z.object({
    event: z.literal('error'),
    conversation_id: z.string().uuid(),
    message_id: z.string().uuid(),
    answer: z.string().optional().default(''),
    done: z.boolean().optional(),
    error: z.string().optional(),
  }),
])

export const messageListQuerySchema = z.object({
  conversation_id: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
})
