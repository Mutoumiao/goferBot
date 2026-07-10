import type { z } from 'zod'
import type {
  chatMessagesChunkSchema,
  chatMessagesRequestSchema,
  chatProvidersResponseSchema,
  chatSourceItemSchema,
  messageListQuerySchema,
  messageListResponseSchema,
  messageMetadataSchema,
  messageSchema,
  providerListItemSchema,
  sessionListResponseSchema,
} from '../schemas/chat.schema.js'
import type { createSessionRequestSchema, sessionSchema } from '../schemas/session.schema.js'

export type Message = z.infer<typeof messageSchema>
export type ChatSourceItem = z.infer<typeof chatSourceItemSchema>
export type MessageMetadata = z.infer<typeof messageMetadataSchema>
export type Session = z.infer<typeof sessionSchema>
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>
export type MessageListResponse = z.infer<typeof messageListResponseSchema>
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>
export type ProviderListItem = z.infer<typeof providerListItemSchema>
export type ChatProvidersResponse = z.infer<typeof chatProvidersResponseSchema>
export type ChatMessagesRequest = z.infer<typeof chatMessagesRequestSchema>
export type ChatMessagesChunk = z.infer<typeof chatMessagesChunkSchema>
export type MessageListQuery = z.infer<typeof messageListQuerySchema>
