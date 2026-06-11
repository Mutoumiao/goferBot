import type {
  SendMessageRequest,
  StreamChatRequest,
  MessageListResponse,
  SessionListResponse,
  CreateSessionRequest,
  Session,
} from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

/** 发送消息（非流式） */
export const sendMessage = (data: SendMessageRequest) =>
  alovaInstance.Post<{ message: unknown }>('/chat/message', data)

/** SSE 流式聊天 — POST /api/chat（text/event-stream） */
export const streamChat = (params: StreamChatRequest) =>
  alovaInstance.Post('/chat', params)

/** 获取消息历史 */
export const getHistory = (sessionId: string, page = 1, limit = 50) =>
  alovaInstance.Get<MessageListResponse>(`/sessions/${sessionId}/messages`, {
    params: { page, limit },
  })

/** 获取会话列表 */
export const getSessions = (page = 1, limit = 20) =>
  alovaInstance.Get<SessionListResponse>('/sessions', {
    params: { page, limit },
  })

/** 创建新会话 */
export const createSession = (data?: CreateSessionRequest) =>
  alovaInstance.Post<Session>('/sessions', data ?? {})

/** 删除会话 */
export const deleteSession = (sessionId: string) =>
  alovaInstance.Delete(`/sessions/${sessionId}`)

/** 重命名会话 */
export const renameSession = (sessionId: string, title: string) =>
  alovaInstance.Post<Session>(`/sessions/${sessionId}/rename`, { title })
