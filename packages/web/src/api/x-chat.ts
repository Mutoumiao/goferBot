/**
 * @ant-design/x SDK 相关请求配置
 *
 * 规范：所有 HTTP 请求配置集中在此目录，禁止在 feature/provider 中硬编码 URL。
 * 本文件对接后端 SSE 流式聊天接口，供 chat feature 的 Provider 使用。
 */
import { XRequest } from '@ant-design/x-sdk'
import type { SSEOutput } from '@ant-design/x-sdk'

/** 流式聊天输入参数（前端只传 provider/model/baseUrl，不传 apiKey） */
export interface XChatInput {
  message: string
  sessionId: string
  knowledgeBaseIds?: string[]
  config: {
    provider: string
    model: string
    baseUrl: string
  }
}

/** 后端 SSE chunk 格式 */
export interface XChatOutput {
  chunk: string
  done: boolean
  error?: string
}

/** 对话消息格式 */
export interface XChatMessage {
  content: string
  role: 'user' | 'assistant'
}

/** XRequest 实例 — 供 GoferChatProvider 使用 */
export const xChatRequest = XRequest<XChatInput, SSEOutput>('/api/chat', {
  manual: true,
})
