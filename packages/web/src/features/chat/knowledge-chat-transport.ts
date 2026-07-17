/**
 * KnowledgeChatTransport — 将 Nest Chat SSE 映射为 AI SDK UIMessageChunk 流。
 *
 * 线级契约（packages/data chatMessagesChunkSchema，本 change 零变更）：
 *   sources → data-sources（可先于正文）
 *   message → text-start/text-delta
 *   message_end → text-end + finish
 *   error → error（保留已收 text）+ finish
 *   坏 JSON 帧 → 忽略
 *
 * 不复用 CompanionChatTransport；仅复制经证明的 text-id / credentials / finish 守卫模式。
 */
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'
import { buildAuthHeader } from '@/utils/auth-token'

export type KnowledgeTransportBody = {
  conversation_id?: string
  knowledge_base_ids?: string[]
  provider_key?: string
  retrieval_mode?: 'strict' | 'loose'
  parent_message_id?: string | null
  inputs?: Record<string, unknown>
  files?: unknown[]
}

export type KnowledgeSourcesPayload = {
  sources: Array<{
    kb_id: string
    document_id: string
    chunk_id?: string
    content?: string
    score?: number
    parent_id?: string
  }>
  retrieval_empty?: boolean
}

function extractLastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const parts = msg.parts ?? []
    const text = parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('')
    if (text.trim()) return text.trim()
    const legacy = (msg as { content?: string }).content
    if (typeof legacy === 'string' && legacy.trim()) return legacy.trim()
  }
  return ''
}

/**
 * 解析标准 SSE 块（空行分隔）。
 * Nest: `event: sources\ndata: {"event":"sources",...}\n\n`
 */
export function parseChatSseBlock(
  block: string,
): { event: string; data: Record<string, unknown> } | null {
  const lines = block.split(/\r?\n/).map((l) => l.trimEnd())
  let eventName = ''
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
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // 坏 JSON 帧：忽略
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  const data = parsed as Record<string, unknown>
  const event = eventName || (typeof data.event === 'string' ? data.event : '') || 'message'
  return { event, data }
}

export class KnowledgeChatTransport implements ChatTransport<UIMessage> {
  private readonly baseUrl: string
  private readonly getConversationId: () => string
  private readonly getKnowledgeBaseIds: () => string[]
  private readonly getProviderKey: () => string | undefined
  private readonly getRetrievalMode: () => 'strict' | 'loose'

  constructor(options?: {
    baseUrl?: string
    getConversationId?: () => string
    getKnowledgeBaseIds?: () => string[]
    getProviderKey?: () => string | undefined
    getRetrievalMode?: () => 'strict' | 'loose'
  }) {
    this.baseUrl = options?.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api'
    this.getConversationId = options?.getConversationId ?? (() => '')
    this.getKnowledgeBaseIds = options?.getKnowledgeBaseIds ?? (() => [])
    this.getProviderKey = options?.getProviderKey ?? (() => undefined)
    this.getRetrievalMode = options?.getRetrievalMode ?? (() => 'strict')
  }

  async sendMessages(options: {
    trigger: 'submit-message' | 'regenerate-message'
    chatId: string
    messageId: string | undefined
    messages: UIMessage[]
    abortSignal: AbortSignal | undefined
    headers?: Record<string, string> | Headers
    body?: object
    metadata?: unknown
  }): Promise<ReadableStream<UIMessageChunk>> {
    const bodyObj = (options.body ?? {}) as Partial<KnowledgeTransportBody>
    const conversationId = bodyObj.conversation_id || this.getConversationId() || options.chatId
    const query = extractLastUserText(options.messages)
    const knowledgeBaseIds = bodyObj.knowledge_base_ids?.length
      ? bodyObj.knowledge_base_ids
      : this.getKnowledgeBaseIds()
    const providerKey = bodyObj.provider_key ?? this.getProviderKey()
    const retrievalMode = bodyObj.retrieval_mode ?? this.getRetrievalMode()

    if (!conversationId) {
      throw new Error('缺少 conversation_id，无法发起知识问答')
    }
    if (!query) {
      throw new Error('消息内容为空')
    }
    if (!knowledgeBaseIds.length) {
      throw new Error('请先选择至少一个知识库')
    }

    const authHeader = buildAuthHeader()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    }
    if (authHeader) {
      headers.Authorization = authHeader
    }

    const response = await fetch(`${this.baseUrl}/chat-messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        response_mode: 'streaming',
        query,
        conversation_id: conversationId,
        knowledge_base_ids: knowledgeBaseIds,
        provider_key: providerKey,
        retrieval_mode: retrievalMode,
        parent_message_id: bodyObj.parent_message_id,
        inputs: bodyObj.inputs,
        files: bodyObj.files,
      }),
      credentials: 'include',
      signal: options.abortSignal,
    })

    if (!response.ok) {
      throw new Error(`Chat SSE 请求失败: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('ReadableStream 不可用')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    const textId = `text-${Date.now()}`
    let textStarted = false
    let finished = false
    /** 已收到的 sources，避免 message_end 用空列表覆盖（getMessageSources 取最后一次 data-sources） */
    let lastSources: unknown[] | undefined
    let lastRetrievalEmpty: boolean | undefined
    let sourcesEventSeen = false

    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        const enqueue = (chunk: UIMessageChunk) => {
          if (finished) return
          controller.enqueue(chunk)
        }

        const ensureTextStart = () => {
          if (!textStarted) {
            textStarted = true
            enqueue({ type: 'text-start', id: textId })
          }
        }

        const finishText = () => {
          if (textStarted) {
            enqueue({ type: 'text-end', id: textId })
          }
        }

        const handleEvent = (event: string, data: Record<string, unknown>) => {
          if (event === 'sources') {
            const sources = Array.isArray(data.sources) ? data.sources : []
            sourcesEventSeen = true
            lastSources = sources
            if (typeof data.retrieval_empty === 'boolean') {
              lastRetrievalEmpty = data.retrieval_empty
            }
            enqueue({
              type: 'data-sources',
              data: {
                sources,
                retrieval_empty: data.retrieval_empty,
              },
            } as UIMessageChunk)
            return
          }

          if (event === 'message') {
            const delta = typeof data.answer === 'string' ? data.answer : ''
            if (!delta) return
            ensureTextStart()
            enqueue({ type: 'text-delta', id: textId, delta })
            return
          }

          if (event === 'message_end') {
            // 若无增量但 end 带全文，补一次 delta（兼容）
            const full = typeof data.answer === 'string' ? data.answer : ''
            if (!textStarted && full) {
              ensureTextStart()
              enqueue({ type: 'text-delta', id: textId, delta: full })
            }
            // 仅在「从未 sources 事件」或 retrieval_empty 终态变化时补 data-sources；
            // 禁止用 sources:[] 覆盖已展示的引用（Nest message_end 常不带 sources 列表）
            const endEmpty =
              typeof data.retrieval_empty === 'boolean' ? data.retrieval_empty : undefined
            if (Array.isArray(data.sources)) {
              lastSources = data.sources
              sourcesEventSeen = true
              enqueue({
                type: 'data-sources',
                data: {
                  sources: data.sources,
                  retrieval_empty: endEmpty ?? lastRetrievalEmpty,
                },
              } as UIMessageChunk)
            } else if (!sourcesEventSeen && endEmpty === true) {
              enqueue({
                type: 'data-sources',
                data: {
                  sources: [],
                  retrieval_empty: true,
                },
              } as UIMessageChunk)
            } else if (
              sourcesEventSeen &&
              endEmpty !== undefined &&
              endEmpty !== lastRetrievalEmpty
            ) {
              enqueue({
                type: 'data-sources',
                data: {
                  sources: lastSources ?? [],
                  retrieval_empty: endEmpty,
                },
              } as UIMessageChunk)
            }
            finishText()
            enqueue({ type: 'finish', finishReason: 'stop' })
            finished = true
            controller.close()
            return
          }

          if (event === 'error') {
            const errText =
              (typeof data.error === 'string' && data.error) ||
              (typeof data.message === 'string' && data.message) ||
              '生成失败'
            // 保留已收部分内容：不回滚 text，仅附加 error 并 finish
            finishText()
            enqueue({ type: 'error', errorText: errText })
            enqueue({ type: 'finish', finishReason: 'error' })
            finished = true
            controller.close()
          }
          // unknown → ignore
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split(/\r?\n\r?\n/)
            buffer = parts.pop() ?? ''

            for (const block of parts) {
              if (finished) return
              const parsed = parseChatSseBlock(block)
              if (!parsed) continue
              handleEvent(parsed.event, parsed.data)
            }
          }

          if (!finished && buffer.trim()) {
            const parsed = parseChatSseBlock(buffer)
            if (parsed) handleEvent(parsed.event, parsed.data)
          }

          if (!finished) {
            finishText()
            enqueue({ type: 'finish', finishReason: 'stop' })
            finished = true
            controller.close()
          }
        } catch (err) {
          if (!finished) {
            finishText()
            enqueue({
              type: 'error',
              errorText: err instanceof Error ? err.message : String(err),
            })
            enqueue({ type: 'finish', finishReason: 'error' })
            finished = true
            try {
              controller.close()
            } catch {
              /* already closed */
            }
          }
        } finally {
          try {
            reader.releaseLock()
          } catch {
            /* ignore */
          }
        }
      },
      cancel() {
        reader.cancel().catch(() => undefined)
      },
    })
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    // Chat SSE 无服务端可恢复流
    return null
  }
}
