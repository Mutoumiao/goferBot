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

/** SSE 流式聊天请求参数 */
export interface StreamChatParams {
  message: string
  sessionId: string
  knowledgeBaseIds?: string[]
  config: {
    provider: string
    model: string
    baseUrl: string
    apiKey: string
  }
}

/** SSE 流式聊天 — POST /api/chat（text/event-stream） */
export const streamChat = (params: StreamChatParams) =>
  alovaInstance.Post('/chat', {
    message: params.message,
    sessionId: params.sessionId,
    knowledgeBaseIds: params.knowledgeBaseIds ?? [],
    config: params.config,
  })

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
