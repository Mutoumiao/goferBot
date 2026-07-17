/**
 * 统一从 UIMessage 读取 sources / retrieval_empty。
 * 流式：Transport 写入 data-sources part
 * 历史：hydrate 时写入 metadata 与/或 data-sources part
 * UI 禁止第三份并行 sources store 作为权威。
 */
import type { ChatSourceItem, Message } from '@goferbot/data'
import type { UIMessage } from 'ai'

export type SourcesDataPayload = {
  sources?: ChatSourceItem[]
  retrieval_empty?: boolean
}

function isSourcesPart(
  part: UIMessage['parts'][number],
): part is { type: 'data-sources'; data: SourcesDataPayload } {
  return (
    !!part &&
    typeof part === 'object' &&
    'type' in part &&
    (part as { type: string }).type === 'data-sources'
  )
}

/** 从消息 parts 与 metadata 读取引用列表（流式优先最后一次 data-sources） */
export function getMessageSources(msg: UIMessage): ChatSourceItem[] | undefined {
  const parts = msg.parts ?? []
  let fromParts: ChatSourceItem[] | undefined
  for (const part of parts) {
    if (!isSourcesPart(part)) continue
    const sources = part.data?.sources
    if (Array.isArray(sources)) {
      fromParts = sources as ChatSourceItem[]
    }
  }
  if (fromParts !== undefined) return fromParts

  const meta = (msg as UIMessage & { metadata?: SourcesDataPayload | null }).metadata
  if (meta && Array.isArray(meta.sources)) {
    return meta.sources
  }
  return undefined
}

/** 是否空检索（流式 data part 或历史 metadata） */
export function getRetrievalEmpty(msg: UIMessage): boolean {
  const parts = msg.parts ?? []
  let fromParts: boolean | undefined
  for (const part of parts) {
    if (!isSourcesPart(part)) continue
    if (typeof part.data?.retrieval_empty === 'boolean') {
      fromParts = part.data.retrieval_empty
    }
  }
  if (fromParts !== undefined) return fromParts

  const meta = (msg as UIMessage & { metadata?: SourcesDataPayload | null }).metadata
  return Boolean(meta?.retrieval_empty)
}

/** 提取 UIMessage 纯文本 */
export function textFromUiMessage(msg: UIMessage): string {
  const parts = msg.parts ?? []
  const fromParts = parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
  if (fromParts) return fromParts
  const legacy = (msg as { content?: string }).content
  return typeof legacy === 'string' ? legacy : ''
}

/**
 * 历史 Message → UIMessage（含 metadata sources 与 data-sources part，供统一选择器读取）
 */
export function historyMessageToUiMessage(message: {
  id: string
  role: string
  content: string
  metadata?: unknown
}): UIMessage {
  const meta = message.metadata as SourcesDataPayload | null | undefined
  const parts: UIMessage['parts'] = []

  if (meta && (Array.isArray(meta.sources) || meta.retrieval_empty !== undefined)) {
    parts.push({
      type: 'data-sources',
      data: {
        sources: meta.sources ?? [],
        retrieval_empty: meta.retrieval_empty,
      },
    } as UIMessage['parts'][number])
  }

  parts.push({ type: 'text', text: message.content ?? '' })

  return {
    id: message.id,
    role: message.role as UIMessage['role'],
    parts,
    ...(meta ? { metadata: meta } : {}),
  } as UIMessage
}

/**
 * UIMessage[] → 缓存用 Message[]（供 conversationStore）。
 * 同 id 时保留 previous.createdAt，避免流式/定稿同步时时间戳抖动。
 */
export function uiMessagesToMessages(
  uiMessages: UIMessage[],
  conversationId: string,
  previous?: Message[] | null,
): Message[] {
  const prevById = new Map((previous ?? []).map((m) => [m.id, m]))
  return uiMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m, index) => {
      const sources = getMessageSources(m)
      const retrievalEmpty = getRetrievalEmpty(m)
      const id = m.id || `msg-${conversationId}-${index}`
      const prev = prevById.get(id)
      return {
        id,
        sessionId: conversationId,
        role: m.role as 'user' | 'assistant',
        content: textFromUiMessage(m),
        createdAt: prev?.createdAt ?? new Date().toISOString(),
        metadata:
          sources !== undefined || retrievalEmpty
            ? {
                sources,
                retrieval_empty: retrievalEmpty || undefined,
              }
            : undefined,
      }
    })
}
