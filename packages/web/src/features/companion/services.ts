/**
 * Companion 模块 API 调用层。
 *
 * 复用项目已有的 alova 实例（`@/utils/server`），不引入新 HTTP 库。
 * 所有方法返回 alova Method 实例，调用方通过 `.send()` 触发请求。
 */
import { alovaInstance } from '@/utils/server'
import type {
  Companion,
  CompanionListResponse,
  Conversation,
  ConversationListResponse,
  CreateCompanionPayload,
  CreateConversationPayload,
  CreateFeedbackPayload,
  Feedback,
  FetchParams,
  MemoryListResponse,
  MessageListResponse,
  UpdateCompanionPayload,
  UpdateCompanionStatusPayload,
} from './types'

// alova baseURL 已含 /api，此处只写业务 path，避免 /api/api 双前缀

// ---- 伴侣 CRUD ----

export function createCompanion(payload: CreateCompanionPayload) {
  return alovaInstance.Post<Companion>('/companions', payload)
}

export function listCompanions(params?: FetchParams) {
  return alovaInstance.Get<CompanionListResponse>('/companions', {
    params,
  })
}

export function getCompanion(id: string) {
  return alovaInstance.Get<Companion>(`/companions/${id}`)
}

export function updateCompanion(id: string, payload: UpdateCompanionPayload) {
  return alovaInstance.Put<Companion>(`/companions/${id}`, payload)
}

export function deleteCompanion(id: string) {
  return alovaInstance.Delete<void>(`/companions/${id}`)
}

export function updateCompanionStatus(id: string, payload: UpdateCompanionStatusPayload) {
  return alovaInstance.Patch<Companion>(`/companions/${id}/status`, payload)
}

// ---- 会话管理 ----

export function createConversation(payload: CreateConversationPayload) {
  return alovaInstance.Post<Conversation>('/companion/conversations', payload)
}

export function listConversations(companionId: string, params?: { page?: number; size?: number }) {
  return alovaInstance.Get<ConversationListResponse>('/companion/conversations', {
    params: { ...params, companionId },
  })
}

export function getConversation(id: string) {
  return alovaInstance.Get<Conversation>(`/companion/conversations/${id}`)
}

// ---- 聊天 / 消息 / 反馈 / 记忆 ----

export function listMessages(conversationId: string, params?: { page?: number; size?: number }) {
  return alovaInstance.Get<MessageListResponse>(
    `/companion/conversations/${conversationId}/messages`,
    { params },
  )
}

export function submitFeedback(messageId: string, payload: CreateFeedbackPayload) {
  return alovaInstance.Post<Feedback>(`/companion/messages/${messageId}/feedback`, payload)
}

export function listMemories(companionId: string, params?: { page?: number; size?: number }) {
  return alovaInstance.Get<MemoryListResponse>('/companion/memories', {
    params: { ...params, companionId },
  })
}
