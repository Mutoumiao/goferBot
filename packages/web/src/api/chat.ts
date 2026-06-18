import type {
  ChatProvidersResponse,
  CreateSessionRequest,
  MessageListResponse,
  Session,
  SessionListResponse,
} from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

/** 获取模型列表 */
export const getChatProviders = () =>
  alovaInstance.Get<ChatProvidersResponse>('/chat-messages/providers')

/** 获取消息历史 — Dify 风格 */
export const getMessages = (conversationId: string, page = 1, size = 20) =>
  alovaInstance.Get<MessageListResponse>('/chat-messages', {
    params: { conversation_id: conversationId, page, size },
  })

/** 获取会话列表 */
export const getSessions = (page = 1, size = 20) =>
  alovaInstance.Get<SessionListResponse>('/sessions', {
    params: { page, size },
  })

/** 根据 ID 获取单个会话详情 */
export const getSessionById = (sessionId: string) =>
  alovaInstance.Get<Session>(`/sessions/${sessionId}`)

/** 创建新会话 */
export const createSession = (data?: CreateSessionRequest) =>
  alovaInstance.Post<Session>('/sessions', data ?? {})

/** 删除会话 */
export const deleteSession = (sessionId: string) => alovaInstance.Delete(`/sessions/${sessionId}`)

/** 重命名会话 */
export const renameSession = (sessionId: string, title: string) =>
  alovaInstance.Post<Session>(`/sessions/${sessionId}/rename`, { title })
