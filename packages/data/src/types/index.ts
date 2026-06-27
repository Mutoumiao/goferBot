import type { z } from 'zod'
import {
  adminUserListQuerySchema,
  adminUserListResponseSchema,
  adminUserSchema,
  assignRoleRequestSchema,
  createAdminUserRequestSchema,
  resetPasswordRequestSchema,
  updateAdminUserRequestSchema,
  updateUserStatusRequestSchema,
} from '../schemas/admin.schema.js'
import {
  authResponseSchema,
  loginRequestSchema,
  publicKeyResponseSchema,
  registerRequestSchema,
  updateProfileRequestSchema,
  userSchema,
} from '../schemas/auth.schema.js'
import {
  chatMessagesChunkSchema,
  chatMessagesRequestSchema,
  chatProvidersResponseSchema,
  messageListQuerySchema,
  messageListResponseSchema,
  messageSchema,
  providerListItemSchema,
  sessionListResponseSchema,
} from '../schemas/chat.schema.js'
import { pagerRequestSchema, paginationSchema } from '../schemas/common.schema.js'
import {
  createDocumentRequestSchema,
  documentSchema,
  moveDocumentRequestSchema,
  updateDocumentRequestSchema,
} from '../schemas/document.schema.js'
import {
  createFolderRequestSchema,
  folderSchema,
  moveFolderRequestSchema,
  updateFolderRequestSchema,
} from '../schemas/folder.schema.js'
import {
  createKbRequestSchema,
  documentStatusResponseSchema,
  documentStatusSchema,
  kbDetailResponseSchema,
  kbEntrySchema,
  kbListResponseSchema,
  kbSelectorEntrySchema,
  kbSelectorResponseSchema,
  updateKbRequestSchema,
} from '../schemas/kb.schema.js'
import {
  createSessionRequestSchema,
  sessionSchema,
  updateSessionRequestSchema,
} from '../schemas/session.schema.js'
import {
  appearanceConfigSchema,
  availableProvidersResponseSchema,
  type CategorySettingsMap,
  chatConfigSchema,
  companionConfigSchema,
  indexingConfigSchema,
  modelProviderSchema,
  providerTypeSchema,
  ragConfigSchema,
  settingCategorySchema,
  settingsResponseSchema,
  settingsSchema,
} from '../schemas/settings.schema.js'

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
export type KbSelectorEntry = z.infer<typeof kbSelectorEntrySchema>
export type KbSelectorResponse = z.infer<typeof kbSelectorResponseSchema>
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
export type MoveDocumentRequest = z.infer<typeof moveDocumentRequestSchema>

export type Folder = z.infer<typeof folderSchema>
export type CreateFolderRequest = z.infer<typeof createFolderRequestSchema>
export type UpdateFolderRequest = z.infer<typeof updateFolderRequestSchema>
export type MoveFolderRequest = z.infer<typeof moveFolderRequestSchema>

export type AdminUser = z.infer<typeof adminUserSchema>
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>
export type UpdateUserStatusRequest = z.infer<typeof updateUserStatusRequestSchema>
export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>
export type CreateAdminUserRequest = z.infer<typeof createAdminUserRequestSchema>
export type UpdateAdminUserRequest = z.infer<typeof updateAdminUserRequestSchema>
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>
export type AssignRoleRequest = z.infer<typeof assignRoleRequestSchema>

export type Settings = z.infer<typeof settingsSchema>
export type SettingsResponse = z.infer<typeof settingsResponseSchema>
export type ProviderType = z.infer<typeof providerTypeSchema>
export type ModelProvider = z.infer<typeof modelProviderSchema>
export type ChatSettings = z.infer<typeof chatConfigSchema>
export type RagSettings = z.infer<typeof ragConfigSchema>
export type CompanionSettings = z.infer<typeof companionConfigSchema>
export type IndexingSettings = z.infer<typeof indexingConfigSchema>
export type AppearanceSettings = z.infer<typeof appearanceConfigSchema>
export type SettingCategory = z.infer<typeof settingCategorySchema>
export type AvailableProvidersResponse = z.infer<typeof availableProvidersResponseSchema>
export type { CategorySettingsMap }

export {
  adminUserListQuerySchema,
  adminUserListResponseSchema,
  adminUserSchema,
  appearanceConfigSchema,
  assignRoleRequestSchema,
  authResponseSchema,
  availableProvidersResponseSchema,
  chatConfigSchema,
  chatMessagesChunkSchema,
  chatMessagesRequestSchema,
  chatProvidersResponseSchema,
  companionConfigSchema,
  createAdminUserRequestSchema,
  createDocumentRequestSchema,
  createFolderRequestSchema,
  createKbRequestSchema,
  createSessionRequestSchema,
  documentSchema,
  documentStatusResponseSchema,
  documentStatusSchema,
  folderSchema,
  indexingConfigSchema,
  kbDetailResponseSchema,
  kbEntrySchema,
  kbListResponseSchema,
  kbSelectorEntrySchema,
  kbSelectorResponseSchema,
  loginRequestSchema,
  messageListQuerySchema,
  messageListResponseSchema,
  messageSchema,
  modelProviderSchema,
  moveDocumentRequestSchema,
  moveFolderRequestSchema,
  pagerRequestSchema,
  paginationSchema,
  providerListItemSchema,
  providerTypeSchema,
  publicKeyResponseSchema,
  ragConfigSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  sessionListResponseSchema,
  sessionSchema,
  settingCategorySchema,
  settingsResponseSchema,
  settingsSchema,
  updateAdminUserRequestSchema,
  updateDocumentRequestSchema,
  updateFolderRequestSchema,
  updateKbRequestSchema,
  updateProfileRequestSchema,
  updateSessionRequestSchema,
  updateUserStatusRequestSchema,
  userSchema,
}
