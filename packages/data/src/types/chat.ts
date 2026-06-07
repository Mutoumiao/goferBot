import type { z } from 'zod'
import type {
  messageSchema,
  sessionSchema,
  sendMessageRequestSchema,
  createSessionRequestSchema,
  messageListResponseSchema,
  sessionListResponseSchema,
} from '../schemas/chat.schema'

export type Message = z.infer<typeof messageSchema>
export type Session = z.infer<typeof sessionSchema>
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>
export type MessageListResponse = z.infer<typeof messageListResponseSchema>
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>
