/**
 * Companion SSE 客户端封装。
 *
 * 使用原生 fetch + ReadableStream，不引入新 SSE 库。
 * 事件格式对齐后端 SseResponseHelper：token | done | error。
 */

export interface SseTokenEvent {
  event: 'token'
  data: string // 流式 token 内容
}

export interface SseDoneEvent {
  event: 'done'
  data: {
    messageId: string
    content: string
    createdAt: string
  }
}

export interface SseErrorEvent {
  event: 'error'
  data: { message: string; code?: string }
}

export type CompanionSseEvent = SseTokenEvent | SseDoneEvent | SseErrorEvent

interface ChatPayload {
  conversationId: string
  content: string
}

/** 逐行解析 SSE 流，每行格式：event:xxx\ndata:... */
function parseSseLine(line: string): CompanionSseEvent | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':')) return null

  const eventMatch = /^event:(.+)$/.exec(trimmed)
  const dataMatch = /^data:(.*)$/.exec(trimmed)

  if (eventMatch && dataMatch) {
    const event = eventMatch[1].trim() as CompanionSseEvent['event']
    const raw = dataMatch[1].trim()
    try {
      const parsed = JSON.parse(raw)
      return { event, data: parsed } as CompanionSseEvent
    } catch {
      return { event, data: raw } as CompanionSseEvent
    }
  }

  return null
}

export class CompanionSseClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? (import.meta.env.VITE_API_BASE_URL ?? '/api')
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
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const event = parseSseLine(line)
          if (event) onEvent(event)
        }
      }

      // 处理缓冲区剩余内容
      if (buffer.trim()) {
        const event = parseSseLine(buffer)
        if (event) onEvent(event)
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  }
}
