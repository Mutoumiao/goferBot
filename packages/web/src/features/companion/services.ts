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

const BASE = '/api'

// ---- 伴侣 CRUD ----

export function createCompanion(payload: CreateCompanionPayload) {
  return alovaInstance.Post<Companion>(`${BASE}/companions`, payload)
}

export function listCompanions(params?: FetchParams) {
  return alovaInstance.Get<CompanionListResponse>(`${BASE}/companions`, {
    params,
  })
}

export function getCompanion(id: string) {
  return alovaInstance.Get<Companion>(`${BASE}/companions/${id}`)
}

export function updateCompanion(id: string, payload: UpdateCompanionPayload) {
  return alovaInstance.Put<Companion>(`${BASE}/companions/${id}`, payload)
}

export function deleteCompanion(id: string) {
  return alovaInstance.Delete<void>(`${BASE}/companions/${id}`)
}

export function updateCompanionStatus(id: string, payload: UpdateCompanionStatusPayload) {
  return alovaInstance.Patch<Companion>(`${BASE}/companions/${id}/status`, payload)
}

// ---- 会话管理 ----

export function createConversation(payload: CreateConversationPayload) {
  return alovaInstance.Post<Conversation>(`${BASE}/companion/conversations`, payload)
}

export function listConversations(companionId: string, params?: { page?: number; size?: number }) {
  return alovaInstance.Get<ConversationListResponse>(`${BASE}/companion/conversations`, {
    params: { ...params, companionId },
  })
}

export function getConversation(id: string) {
  return alovaInstance.Get<Conversation>(`${BASE}/companion/conversations/${id}`)
}

// ---- 聊天 / 消息 / 反馈 / 记忆 ----

export function listMessages(conversationId: string, params?: { page?: number; size?: number }) {
  return alovaInstance.Get<MessageListResponse>(
    `${BASE}/companion/conversations/${conversationId}/messages`,
    { params },
  )
}

export function submitFeedback(messageId: string, payload: CreateFeedbackPayload) {
  return alovaInstance.Post<Feedback>(`${BASE}/companion/messages/${messageId}/feedback`, payload)
}

export function listMemories(companionId: string, params?: { page?: number; size?: number }) {
  return alovaInstance.Get<MemoryListResponse>(`${BASE}/companion/memories`, {
    params: { ...params, companionId },
  })
}
