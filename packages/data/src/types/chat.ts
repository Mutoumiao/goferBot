import type { z } from 'zod'
import type {
  messageSchema,
  streamChatRequestSchema,
  sendMessageRequestSchema,
  messageListResponseSchema,
  sessionListResponseSchema,
  providerListItemSchema,
  chatInitResponseSchema,
  chatProvidersResponseSchema,
  chatMessagesRequestSchema,
  chatMessagesChunkSchema,
  messageListQuerySchema,
} from '../schemas/chat.schema.js'
import type {
  createSessionRequestSchema,
  sessionSchema,
} from '../schemas/session.schema.js'

export type Message = z.infer<typeof messageSchema>
export type Session = z.infer<typeof sessionSchema>
export type StreamChatRequest = z.infer<typeof streamChatRequestSchema>
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>
export type MessageListResponse = z.infer<typeof messageListResponseSchema>
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>
export type ProviderListItem = z.infer<typeof providerListItemSchema>
export type ChatInitResponse = z.infer<typeof chatInitResponseSchema>
export type ChatProvidersResponse = z.infer<typeof chatProvidersResponseSchema>
export type ChatMessagesRequest = z.infer<typeof chatMessagesRequestSchema>
export type ChatMessagesChunk = z.infer<typeof chatMessagesChunkSchema>
export type MessageListQuery = z.infer<typeof messageListQuerySchema>