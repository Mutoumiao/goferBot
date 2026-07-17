/**
 * UT-KC-*: KnowledgeChatTransport SSE → UIMessageChunk 映射
 * 锁定 design D3：sources 先于 text、增量累积、message_end、error 保留部分内容、retrieval_empty
 */
import type { UIMessage } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  KnowledgeChatTransport,
  parseChatSseBlock,
} from '../../src/features/chat/knowledge-chat-transport'
import {
  getMessageSources,
  getRetrievalEmpty,
  historyMessageToUiMessage,
  textFromUiMessage,
  uiMessagesToMessages,
} from '../../src/features/chat/message-sources'

const KB = '11111111-1111-1111-1111-111111111111'
const DOC = '22222222-2222-2222-2222-222222222222'
const MSG = '33333333-3333-3333-3333-333333333333'
const CONV = '44444444-4444-4444-4444-444444444444'

function ssePayload(blocks: string[]): string {
  return `${blocks.join('\n\n')}\n\n`
}

function mockFetchStream(chunks: string[], status = 200) {
  const encoder = new TextEncoder()
  let i = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]))
      } else {
        controller.close()
      }
    },
  })
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body: stream,
  })
}

async function collect(stream: ReadableStream<unknown>) {
  const out: unknown[] = []
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out.push(value)
  }
  return out
}

const userMsg = {
  id: 'u1',
  role: 'user',
  parts: [{ type: 'text', text: '什么是 RAG？' }],
} as UIMessage

function makeTransport() {
  return new KnowledgeChatTransport({
    getConversationId: () => CONV,
    getKnowledgeBaseIds: () => [KB],
  })
}

async function send(transport: KnowledgeChatTransport) {
  return transport.sendMessages({
    trigger: 'submit-message',
    chatId: CONV,
    messageId: undefined,
    messages: [userMsg],
    abortSignal: undefined,
    body: {
      conversation_id: CONV,
      knowledge_base_ids: [KB],
      retrieval_mode: 'strict',
    },
  })
}

describe('parseChatSseBlock', () => {
  it('parses event line + data JSON', () => {
    const parsed = parseChatSseBlock(
      `event: sources\ndata: ${JSON.stringify({
        event: 'sources',
        conversation_id: CONV,
        message_id: MSG,
        sources: [{ kb_id: KB, document_id: DOC }],
        retrieval_empty: false,
      })}`,
    )
    expect(parsed?.event).toBe('sources')
    expect(Array.isArray(parsed?.data.sources)).toBe(true)
  })

  it('ignores bad JSON frames', () => {
    expect(parseChatSseBlock('event: message\ndata: {not-json')).toBeNull()
  })
})

describe('UT-KC: KnowledgeChatTransport', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('UT-KC-sources-before-text: sources then deltas then message_end', async () => {
    globalThis.fetch = mockFetchStream([
      ssePayload([
        `event: sources\ndata: ${JSON.stringify({
          event: 'sources',
          conversation_id: CONV,
          message_id: MSG,
          sources: [{ kb_id: KB, document_id: DOC, content: 'ctx' }],
          retrieval_empty: false,
        })}`,
        `event: message\ndata: ${JSON.stringify({
          event: 'message',
          conversation_id: CONV,
          message_id: MSG,
          answer: 'hello',
        })}`,
        `event: message\ndata: ${JSON.stringify({
          event: 'message',
          conversation_id: CONV,
          message_id: MSG,
          answer: ' world',
        })}`,
        `event: message_end\ndata: ${JSON.stringify({
          event: 'message_end',
          conversation_id: CONV,
          message_id: MSG,
          answer: '',
          retrieval_empty: false,
        })}`,
      ]),
    ])

    const stream = await send(makeTransport())
    const chunks = await collect(stream)
    const types = chunks.map((c) => (c as { type: string }).type)

    // sources 先于 text
    const sourcesIdx = types.indexOf('data-sources')
    const textStartIdx = types.indexOf('text-start')
    expect(sourcesIdx).toBeGreaterThanOrEqual(0)
    expect(textStartIdx).toBeGreaterThan(sourcesIdx)

    expect(types).toContain('text-delta')
    expect(types).toContain('text-end')
    expect(types).toContain('finish')

    const deltas = chunks
      .filter((c) => (c as { type: string }).type === 'text-delta')
      .map((c) => (c as { delta: string }).delta)
    expect(deltas.join('')).toBe('hello world')

    const sourcesChunks = chunks.filter(
      (c) => (c as { type: string }).type === 'data-sources',
    ) as Array<{ data: { sources: unknown[]; retrieval_empty?: boolean } }>
    // message_end 不得用空 sources 覆盖（回归：曾错误在 end 时再推 sources:[]）
    expect(sourcesChunks).toHaveLength(1)
    expect(sourcesChunks[0].data.sources).toHaveLength(1)
    expect(sourcesChunks[0].data.retrieval_empty).toBe(false)

    // 请求体校验
    expect(globalThis.fetch).toHaveBeenCalled()
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.conversation_id).toBe(CONV)
    expect(body.knowledge_base_ids).toEqual([KB])
    expect(body.query).toBe('什么是 RAG？')
    expect(body.response_mode).toBe('streaming')
    expect((init as RequestInit).credentials).toBe('include')
  })

  it('UT-KC-retrieval-empty: sources with retrieval_empty true', async () => {
    globalThis.fetch = mockFetchStream([
      ssePayload([
        `event: sources\ndata: ${JSON.stringify({
          event: 'sources',
          conversation_id: CONV,
          message_id: MSG,
          sources: [],
          retrieval_empty: true,
        })}`,
        `event: message\ndata: ${JSON.stringify({
          event: 'message',
          conversation_id: CONV,
          message_id: MSG,
          answer: '无资料时的兜底回答',
        })}`,
        `event: message_end\ndata: ${JSON.stringify({
          event: 'message_end',
          conversation_id: CONV,
          message_id: MSG,
          answer: '',
          retrieval_empty: true,
        })}`,
      ]),
    ])

    const stream = await send(makeTransport())
    const chunks = await collect(stream)
    const sourcesChunks = chunks.filter(
      (c) => (c as { type: string }).type === 'data-sources',
    ) as Array<{ data: { sources: unknown[]; retrieval_empty?: boolean } }>
    expect(sourcesChunks.some((c) => c.data.retrieval_empty === true)).toBe(true)
    expect(sourcesChunks[0].data.sources).toEqual([])
  })

  it('UT-KC-partial-error: error after deltas keeps error chunk and finish', async () => {
    globalThis.fetch = mockFetchStream([
      ssePayload([
        `event: message\ndata: ${JSON.stringify({
          event: 'message',
          conversation_id: CONV,
          message_id: MSG,
          answer: '部分内容',
        })}`,
        `event: error\ndata: ${JSON.stringify({
          event: 'error',
          conversation_id: CONV,
          message_id: MSG,
          error: '服务异常',
          done: true,
        })}`,
      ]),
    ])

    const stream = await send(makeTransport())
    const chunks = await collect(stream)
    const types = chunks.map((c) => (c as { type: string }).type)
    expect(types).toContain('text-delta')
    expect(types).toContain('error')
    expect(types).toContain('finish')
    const err = chunks.find((c) => (c as { type: string }).type === 'error') as {
      errorText: string
    }
    expect(err.errorText).toContain('服务异常')
  })

  it('UT-KC-bad-frame: ignores bad JSON and continues', async () => {
    globalThis.fetch = mockFetchStream([
      ssePayload([
        'event: message\ndata: {bad',
        `event: message\ndata: ${JSON.stringify({
          event: 'message',
          conversation_id: CONV,
          message_id: MSG,
          answer: 'ok',
        })}`,
        `event: message_end\ndata: ${JSON.stringify({
          event: 'message_end',
          conversation_id: CONV,
          message_id: MSG,
          answer: '',
        })}`,
      ]),
    ])

    const stream = await send(makeTransport())
    const chunks = await collect(stream)
    const deltas = chunks
      .filter((c) => (c as { type: string }).type === 'text-delta')
      .map((c) => (c as { delta: string }).delta)
    expect(deltas.join('')).toBe('ok')
  })

  it('UT-KC-http-error: non-ok response throws', async () => {
    globalThis.fetch = mockFetchStream([], 500)
    await expect(send(makeTransport())).rejects.toThrow(/500/)
  })

  it('UT-KC-requires-kb: throws when no knowledge_base_ids', async () => {
    const transport = new KnowledgeChatTransport({
      getConversationId: () => CONV,
      getKnowledgeBaseIds: () => [],
    })
    await expect(
      transport.sendMessages({
        trigger: 'submit-message',
        chatId: CONV,
        messageId: undefined,
        messages: [userMsg],
        abortSignal: undefined,
        body: { conversation_id: CONV, knowledge_base_ids: [] },
      }),
    ).rejects.toThrow(/知识库/)
  })
})

describe('message-sources helpers', () => {
  it('reads sources from data-sources part', () => {
    const msg = {
      id: 'a1',
      role: 'assistant',
      parts: [
        {
          type: 'data-sources',
          data: {
            sources: [{ kb_id: KB, document_id: DOC }],
            retrieval_empty: false,
          },
        },
        { type: 'text', text: 'answer' },
      ],
    } as UIMessage
    expect(getMessageSources(msg)?.[0].document_id).toBe(DOC)
    expect(getRetrievalEmpty(msg)).toBe(false)
    expect(textFromUiMessage(msg)).toBe('answer')
  })

  it('history hydrate preserves sources via metadata + part', () => {
    const ui = historyMessageToUiMessage({
      id: MSG,
      role: 'assistant',
      content: '历史回答',
      metadata: {
        sources: [{ kb_id: KB, document_id: DOC }],
        retrieval_empty: false,
      },
    })
    expect(getMessageSources(ui)?.[0].kb_id).toBe(KB)
    expect(getRetrievalEmpty(ui)).toBe(false)
    expect(textFromUiMessage(ui)).toBe('历史回答')
  })

  it('retrieval_empty without fake sources', () => {
    const ui = historyMessageToUiMessage({
      id: MSG,
      role: 'assistant',
      content: '兜底',
      metadata: { sources: [], retrieval_empty: true },
    })
    expect(getRetrievalEmpty(ui)).toBe(true)
    expect(getMessageSources(ui)).toEqual([])
  })

  it('uiMessagesToMessages preserves previous createdAt by id', () => {
    const ui = {
      id: MSG,
      role: 'assistant',
      parts: [{ type: 'text', text: '更新后的正文' }],
    } as UIMessage
    const prevCreated = '2020-01-01T00:00:00.000Z'
    const mapped = uiMessagesToMessages([ui], CONV, [
      {
        id: MSG,
        sessionId: CONV,
        role: 'assistant',
        content: '旧正文',
        createdAt: prevCreated,
      },
    ])
    expect(mapped).toHaveLength(1)
    expect(mapped[0].content).toBe('更新后的正文')
    expect(mapped[0].createdAt).toBe(prevCreated)
  })
})
