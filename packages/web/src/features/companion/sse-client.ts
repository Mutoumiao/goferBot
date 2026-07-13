/**
 * Companion SSE 客户端封装。
 *
 * 使用原生 fetch + ReadableStream。
 * 事件格式对齐后端 SseResponseHelper（标准多行 SSE）：
 *   event: token|done|error|summary|memories
 *   data: {...}
 */

export interface SseTokenEvent {
  event: 'token'
  /** 增量文本 */
  data: string
}

export interface SseDoneEvent {
  event: 'done'
  data: {
    messageId?: string
    content: string
    createdAt?: string
    fullReply?: string
    quality?: unknown
  }
}

export interface SseErrorEvent {
  event: 'error'
  data: { message: string; code?: string }
}

export type CompanionSseEvent =
  | SseTokenEvent
  | SseDoneEvent
  | SseErrorEvent
  | { event: string; data: unknown }

interface ChatPayload {
  conversationId: string
  content: string
}

/**
 * 解析标准 SSE 块（空行分隔）。
 * 后端写入：`event: xxx\ndata: {...}\n\n`
 */
/** 导出供 CompanionChatTransport 与单测复用 */
export function parseSseBlock(block: string): CompanionSseEvent | null {
  const lines = block.split(/\r?\n/).map((l) => l.trimEnd())
  let eventName = 'message'
  const dataLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(':')) continue
    if (trimmed.startsWith('event:')) {
      eventName = trimmed.slice('event:'.length).trim()
      continue
    }
    if (trimmed.startsWith('data:')) {
      dataLines.push(trimmed.slice('data:'.length).trim())
    }
  }

  if (dataLines.length === 0) return null

  const raw = dataLines.join('\n')
  let parsed: unknown = raw
  try {
    parsed = JSON.parse(raw)
  } catch {
    // 非 JSON 时保留字符串
  }

  if (eventName === 'token') {
    // 后端: { delta: string }；兼容纯字符串
    if (typeof parsed === 'string') {
      return { event: 'token', data: parsed }
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as { delta?: unknown; content?: unknown; data?: unknown }
      const delta = obj.delta ?? obj.content ?? obj.data
      return { event: 'token', data: delta != null ? String(delta) : '' }
    }
    return { event: 'token', data: String(parsed ?? '') }
  }

  if (eventName === 'done') {
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as {
        fullReply?: string
        content?: string
        messageId?: string
        createdAt?: string
        quality?: unknown
      }
      const content = obj.content ?? obj.fullReply ?? ''
      return {
        event: 'done',
        data: {
          content,
          fullReply: obj.fullReply,
          messageId: obj.messageId,
          createdAt: obj.createdAt,
          quality: obj.quality,
        },
      }
    }
    return { event: 'done', data: { content: String(parsed ?? '') } }
  }

  if (eventName === 'error') {
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as { message?: string; error?: string; code?: string }
      return {
        event: 'error',
        data: {
          message: obj.message ?? obj.error ?? 'AI 回复出错',
          code: obj.code,
        },
      }
    }
    return { event: 'error', data: { message: String(parsed ?? 'AI 回复出错') } }
  }

  return { event: eventName, data: parsed }
}

export class CompanionSseClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api'
  }

  async chat(params: {
    conversationId: string
    content: string
    onEvent: (event: CompanionSseEvent) => void
    onError: (error: Error) => void
    signal?: AbortSignal
  }): Promise<void> {
    const { conversationId, content, onEvent, onError, signal } = params

    try {
      const response = await fetch(`${this.baseUrl}/companion/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, content } as ChatPayload),
        credentials: 'include',
        signal,
      })

      if (!response.ok) {
        throw new Error(`SSE request failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('ReadableStream not supported')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        // SSE 事件以空行分隔（\n\n）
        const parts = buffer.split(/\r?\n\r?\n/)
        buffer = parts.pop() ?? ''

        for (const block of parts) {
          const event = parseSseBlock(block)
          if (event) onEvent(event)
        }
      }

      if (buffer.trim()) {
        const event = parseSseBlock(buffer)
        if (event) onEvent(event)
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  }
}
