/**
 * @ant-design/x SDK 相关请求配置
 */

import type { SSEOutput } from '@ant-design/x-sdk'
import { XRequest } from '@ant-design/x-sdk'
import type { ChatMessagesChunk, ChatMessagesRequest } from '@goferbot/data'
import { buildAuthHeader } from '@/utils/auth-token'

export type XChatInput = ChatMessagesRequest

export type { ProviderListItem } from '@goferbot/data'

export type XChatOutput = ChatMessagesChunk

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
  // HttpOnly Cookie 鉴权：必须 include，否则跨端口（:1420 → :3100）SSE 无凭证 → 网络/401 失败
  return fetch(input, { ...init, headers, credentials: 'include' })
}

export const xChatRequest = XRequest<XChatInput, SSEOutput>(`${API_BASE_URL}/chat-messages`, {
  manual: true,
  fetch: authedFetch,
})
