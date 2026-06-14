/**
 * @ant-design/x SDK 相关请求配置
 */
import { XRequest } from '@ant-design/x-sdk'
import type { SSEOutput } from '@ant-design/x-sdk'
import type { ChatMessagesRequest } from '@goferbot/data'
import { buildAuthHeader } from '@/utils/auth-token'

export type XChatInput = ChatMessagesRequest

export type { ChatInitResponse } from '@goferbot/data'
export type { ProviderListItem } from '@goferbot/data'

export interface XChatOutput {
  event: 'message'
  conversation_id: string
  message_id: string
  answer: string
  done?: boolean
  error?: string
}

export interface XChatMessage {
  content: string
  role: 'user' | 'assistant'
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

function authedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  const authHeader = buildAuthHeader()
  if (authHeader) {
    headers.set('Authorization', authHeader)
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(input, { ...init, headers })
}

export const xChatRequest = XRequest<XChatInput, SSEOutput>(`${API_BASE_URL}/chat-messages`, {
  manual: true,
  fetch: authedFetch,
})
