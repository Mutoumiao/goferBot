import type { z } from 'zod'
import {
  loginRequestSchema,
  registerRequestSchema,
  updateProfileRequestSchema,
  userSchema,
  authResponseSchema,
  publicKeyResponseSchema,
} from '../schemas/auth.schema.js'
import {
  kbEntrySchema,
  createKbRequestSchema,
  updateKbRequestSchema,
  kbListResponseSchema,
  kbDetailResponseSchema,
  documentStatusSchema,
  documentStatusResponseSchema,
} from '../schemas/kb.schema.js'
import {
  messageSchema,
  messageListResponseSchema,
  sessionListResponseSchema,
  providerListItemSchema,
  chatProvidersResponseSchema,
  chatMessagesRequestSchema,
  chatMessagesChunkSchema,
  messageListQuerySchema,
} from '../schemas/chat.schema.js'
import {
  createSessionRequestSchema,
  updateSessionRequestSchema,
  sessionSchema,
} from '../schemas/session.schema.js'
import {
  createDocumentRequestSchema,
  updateDocumentRequestSchema,
  documentSchema,
} from '../schemas/document.schema.js'
import {
  createFolderRequestSchema,
  updateFolderRequestSchema,
  folderSchema,
} from '../schemas/folder.schema.js'
import {
  adminUserListQuerySchema,
  updateUserStatusRequestSchema,
  adminUserSchema,
  adminUserListResponseSchema,
} from '../schemas/admin.schema.js'
import {
  settingsSchema,
  settingsResponseSchema,
} from '../schemas/settings.schema.js'
import {
  pagerRequestSchema,
  paginationSchema,
} from '../schemas/common.schema.js'

export type PagerRequest = z.infer<typeof pagerRequestSchema>
export type Pagination = z.infer<typeof paginationSchema>

export type LoginRequest = z.infer<typeof loginRequestSchema>
export type RegisterRequest = z.infer<typeof registerRequestSchema>
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>
export type User = z.infer<typeof userSchema>
export type AuthResponse = z.infer<typeof authResponseSchema>
export type PublicKeyResponse = z.infer<typeof publicKeyResponseSchema>

export type KbEntry = z.infer<typeof kbEntrySchema>
export type CreateKbRequest = z.infer<typeof createKbRequestSchema>
export type UpdateKbRequest = z.infer<typeof updateKbRequestSchema>
export type KbListResponse = z.infer<typeof kbListResponseSchema>
export type KbDetailResponse = z.infer<typeof kbDetailResponseSchema>
export type DocumentStatus = z.infer<typeof documentStatusSchema>
export type DocumentStatusResponse = z.infer<typeof documentStatusResponseSchema>

export type Message = z.infer<typeof messageSchema>
export type Session = z.infer<typeof sessionSchema>
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>
export type UpdateSessionRequest = z.infer<typeof updateSessionRequestSchema>
export type MessageListResponse = z.infer<typeof messageListResponseSchema>
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>
export type ProviderListItem = z.infer<typeof providerListItemSchema>
export type ChatProvidersResponse = z.infer<typeof chatProvidersResponseSchema>
export type ChatMessagesRequest = z.infer<typeof chatMessagesRequestSchema>
export type ChatMessagesChunk = z.infer<typeof chatMessagesChunkSchema>
export type MessageListQuery = z.infer<typeof messageListQuerySchema>

export type Document = z.infer<typeof documentSchema>
export type CreateDocumentRequest = z.infer<typeof createDocumentRequestSchema>
export type UpdateDocumentRequest = z.infer<typeof updateDocumentRequestSchema>

export type Folder = z.infer<typeof folderSchema>
export type CreateFolderRequest = z.infer<typeof createFolderRequestSchema>
export type UpdateFolderRequest = z.infer<typeof updateFolderRequestSchema>

export type AdminUser = z.infer<typeof adminUserSchema>
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>
export type UpdateUserStatusRequest = z.infer<typeof updateUserStatusRequestSchema>
export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>

export type Settings = z.infer<typeof settingsSchema>
export type SettingsResponse = z.infer<typeof settingsResponseSchema>

export {
  pagerRequestSchema,
  paginationSchema,
  loginRequestSchema,
  registerRequestSchema,
  updateProfileRequestSchema,
  userSchema,
  authResponseSchema,
  publicKeyResponseSchema,
  kbEntrySchema,
  createKbRequestSchema,
  updateKbRequestSchema,
  kbListResponseSchema,
  kbDetailResponseSchema,
  documentStatusSchema,
  documentStatusResponseSchema,
  messageSchema,
  messageListResponseSchema,
  sessionListResponseSchema,
  providerListItemSchema,
  chatProvidersResponseSchema,
  chatMessagesRequestSchema,
  chatMessagesChunkSchema,
  messageListQuerySchema,
  createSessionRequestSchema,
  updateSessionRequestSchema,
  sessionSchema,
  createDocumentRequestSchema,
  updateDocumentRequestSchema,
  documentSchema,
  createFolderRequestSchema,
  updateFolderRequestSchema,
  folderSchema,
  adminUserListQuerySchema,
  updateUserStatusRequestSchema,
  adminUserSchema,
  adminUserListResponseSchema,
  settingsSchema,
  settingsResponseSchema,
}
