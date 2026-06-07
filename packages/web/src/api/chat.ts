import type {
  SendMessageRequest,
  MessageListResponse,
  SessionListResponse,
  CreateSessionRequest,
  Session,
} from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

/** 发送消息（非流式） */
export const sendMessage = (data: SendMessageRequest) =>
  alovaInstance.Post<{ message: unknown }>('/chat/message', data)

/** SSE 流式聊天 */
export const streamChat = (sessionId: string, content: string) =>
  alovaInstance.Post('/chat/stream', { sessionId, content })

/** 获取消息历史 */
export const getHistory = (sessionId: string, page = 1, limit = 50) =>
  alovaInstance.Get<MessageListResponse>(`/chat/sessions/${sessionId}/messages`, {
    params: { page, limit },
  })

/** 获取会话列表 */
export const getSessions = (page = 1, limit = 20) =>
  alovaInstance.Get<SessionListResponse>('/chat/sessions', {
    params: { page, limit },
  })

/** 创建新会话 */
export const createSession = (data?: CreateSessionRequest) =>
  alovaInstance.Post<Session>('/chat/sessions', data ?? {})

/** 删除会话 */
export const deleteSession = (sessionId: string) =>
  alovaInstance.Delete(`/chat/sessions/${sessionId}`)

/** 重命名会话 */
export const renameSession = (sessionId: string, title: string) =>
  alovaInstance.Patch<Session>(`/chat/sessions/${sessionId}`, { title })
