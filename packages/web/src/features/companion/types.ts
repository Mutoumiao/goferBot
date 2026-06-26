/**
 * Companion 模块类型定义。
 *
 * 严格对齐后端 CompanionChatController / CompanionManagementController 的 DTO 结构。
 */

export interface PaginationMeta {
  page: number
  size: number
  total: number
  totalPages: number
}

export interface Companion {
  id: string
  name: string
  headline?: string
  description?: string
  personality?: string
  tone?: string
  boundaries?: string
  guardrailsPrompt?: string
  defaultPrompt?: string
  avatarKey?: string
  backgroundStory?: string
  openingMessage?: string
  visibility?: string
  status: CompanionStatus
  lastAssistantMessage?: string
  createdAt: string
  updatedAt: string
}

export type CompanionStatus = 'draft' | 'published' | 'archived'

export interface CompanionListResponse {
  items: Companion[]
  pagination: PaginationMeta
}

export interface CreateCompanionPayload {
  name: string
  headline?: string
  description?: string
  personality?: string
  tone?: string
  boundaries?: string
  guardrailsPrompt?: string
  defaultPrompt?: string
  avatarKey?: string
  backgroundStory?: string
  openingMessage?: string
  visibility?: string
}

export type UpdateCompanionPayload = Partial<CreateCompanionPayload>

export interface UpdateCompanionStatusPayload {
  status: CompanionStatus
}

export interface CreateConversationPayload {
  companionId: string
}

export interface Conversation {
  id: string
  companionId: string
  userId: string
  status: 'active' | 'archived'
  lastMessageAt: string
  createdAt: string
}

export interface ConversationListResponse {
  items: Conversation[]
  pagination: PaginationMeta
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface MessageListResponse {
  items: Message[]
  pagination: PaginationMeta
}

export interface CreateFeedbackPayload {
  rating: number
  comment?: string
}

export interface Feedback {
  id: string
  messageId: string
  rating: number
  comment?: string
  createdAt: string
}

export interface Memory {
  id: string
  companionId: string
  content: string
  importance: number
  createdAt: string
}

export interface MemoryListResponse {
  items: Memory[]
  pagination: PaginationMeta
}

export interface ChatPayload {
  conversationId: string
  content: string
}

export interface FetchParams {
  page?: number
  size?: number
  status?: CompanionStatus
}
