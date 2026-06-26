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
  type: MemoryType
  content: string
  importance: number
  status: 'active' | 'disabled'
  createdAt: string
  updatedAt: string
  sourceMessageId?: string
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

export type CompanionMessageRole = 'user' | 'assistant' | 'system'

export interface CompanionMessage {
  id: string
  conversationId: string
  role: CompanionMessageRole
  content: string
  createdAt: string
  feedback?: CompanionMessageFeedback | null
  streaming?: boolean
}

export interface CompanionMessageFeedback {
  rating: 'up' | 'down'
  comment?: string
}

export type MemoryType =
  | 'preference'
  | 'boundary'
  | 'relationship_goal'
  | 'conversation_style'
  | 'important_fact'

export type MemoryFilter = 'all' | MemoryType

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  preference: '偏好',
  boundary: '边界',
  relationship_goal: '关系目标',
  conversation_style: '对话风格',
  important_fact: '重要事实',
}
