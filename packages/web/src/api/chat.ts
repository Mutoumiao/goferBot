import type {
  SendMessageRequest,
  MessageListResponse,
  SessionListResponse,
  CreateSessionRequest,
  Session,
  ChatInitResponse,
  ChatProvidersResponse,
} from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

/** 发送消息（非流式） */
export const sendMessage = (data: SendMessageRequest) =>
  alovaInstance.Post<{ message: unknown }>('/chat/message', data)

/** 对话初始化 */
export const getChatInit = () =>
  alovaInstance.Get<ChatInitResponse>('/chat/init')

/** 获取模型列表 */
export const getChatProviders = () =>
  alovaInstance.Get<ChatProvidersResponse>('/chat/providers')

/** 获取消息历史 — Dify 风格 */
export const getMessages = (conversationId: string, limit = 20, lastId?: string) =>
  alovaInstance.Get<MessageListResponse>('/messages', {
    params: { conversation_id: conversationId, limit, last_id: lastId },
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
export const deleteSession = (sessionId: string) =>
  alovaInstance.Delete(`/sessions/${sessionId}`)

/** 重命名会话 */
export const renameSession = (sessionId: string, title: string) =>
  alovaInstance.Post<Session>(`/sessions/${sessionId}/rename`, { title })
