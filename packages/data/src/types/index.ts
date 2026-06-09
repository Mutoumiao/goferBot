// Auth types
import type { z } from 'zod'
import {
  loginRequestSchema,
  registerRequestSchema,
  userSchema,
  authResponseSchema,
} from '../schemas/auth.schema'
import {
  kbEntrySchema,
  createKbRequestSchema,
  updateKbRequestSchema,
  kbListResponseSchema,
} from '../schemas/kb.schema'

export type LoginRequest = z.infer<typeof loginRequestSchema>
export type RegisterRequest = z.infer<typeof registerRequestSchema>
export type User = z.infer<typeof userSchema>
export type AuthResponse = z.infer<typeof authResponseSchema>

// KB types
export type KbEntry = z.infer<typeof kbEntrySchema>
export type CreateKbRequest = z.infer<typeof createKbRequestSchema>
export type UpdateKbRequest = z.infer<typeof updateKbRequestSchema>
export type KbListResponse = z.infer<typeof kbListResponseSchema>

// Chat types — re-exported from chat module
export type {
  Message,
  Session,
  SendMessageRequest,
  CreateSessionRequest,
  MessageListResponse,
  SessionListResponse,
} from './chat'

// Re-export schemas for runtime usage
export {
  loginRequestSchema,
  registerRequestSchema,
  userSchema,
  authResponseSchema,
  kbEntrySchema,
  createKbRequestSchema,
  updateKbRequestSchema,
  kbListResponseSchema,
}
