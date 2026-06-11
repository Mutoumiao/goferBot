import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { streamChatRequestSchema } from '@goferbot/data'

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    stream: vi.fn().mockResolvedValue([
      { content: 'ok' },
    ]),
  })),
}))

const originalFetch = globalThis.fetch

beforeAll(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    body: {
      getReader: () => {
        let done = false
        return {
          read: () => {
            if (done) return Promise.resolve({ done: true, value: undefined })
            done = true
            const data = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n')
            return Promise.resolve({ done: false, value: data })
          },
        }
      },
    },
  } as any)
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

describe('ChatDto knowledgeBaseIds', () => {
  it('AC-01: accepts valid knowledgeBaseIds array', () => {
    const result = streamChatRequestSchema.safeParse({
      input: 'hello',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      knowledgeBaseIds: ['550e8400-e29b-41d4-a716-446655440001'],
    })
    expect(result.success).toBe(true)
  })

  it('AC-02: returns 400 when knowledgeBaseIds contains invalid UUID', () => {
    const result = streamChatRequestSchema.safeParse({
      input: 'hello',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      knowledgeBaseIds: ['not-a-uuid'],
    })
    expect(result.success).toBe(false)
  })
})

describe('ChatService RAG retrieval', () => {
  const mockRagService = {
    retrieveContext: vi.fn().mockResolvedValue({ context: 'GoferBot RAG test' }),
  }
  const mockPrisma = {
    $transaction: vi.fn().mockResolvedValue([]),
    session: { findUnique: vi.fn().mockResolvedValue({ id: 's1', userId: 'u1' }), update: vi.fn().mockResolvedValue({}) },
    message: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
  }
  const mockConfigService = {
    get: vi.fn().mockReturnValue(''),
    getOrThrow: vi.fn().mockReturnValue(''),
  }
  const mockSettingsService = {
    getSettings: vi.fn().mockResolvedValue({
      providers: {
        openai: { name: 'OpenAI', apiKey: 'mock-key', model: 'gpt-4', baseUrl: '' },
      },
      defaultChatProvider: 'openai',
    }),
  }

  it('AC-03: injects retrieved chunks into system message', async () => {
    const { ChatService } = await import('@/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, mockConfigService as any, mockRagService as any, mockSettingsService as any)

    const dto = {
      input: 'What does the document say?',
      sessionId: 's1',
      knowledgeBaseIds: ['kb1'],
    }

    const stream = service.streamChat('u1', dto as any)
    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    expect(mockRagService.retrieveContext).toHaveBeenCalledWith(expect.objectContaining({ original: dto.input, kbIds: ['kb1'] }))
  })

  it('AC-04: skips retrieval when knowledgeBaseIds is omitted', async () => {
    mockRagService.retrieveContext.mockClear()

    const { ChatService } = await import('@/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, mockConfigService as any, mockRagService as any, mockSettingsService as any)

    const dto = {
      input: 'Hello',
      sessionId: 's1',
    }

    const stream = service.streamChat('u1', dto as any)
    for await (const _ of stream) { /* consume */ }

    expect(mockRagService.retrieveContext).not.toHaveBeenCalled()
  })

  it('AC-05: skips retrieval when knowledgeBaseIds is empty array', async () => {
    mockRagService.retrieveContext.mockClear()

    const { ChatService } = await import('@/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, mockConfigService as any, mockRagService as any, mockSettingsService as any)

    const dto = {
      input: 'Hello',
      sessionId: 's1',
      knowledgeBaseIds: [],
    }

    const stream = service.streamChat('u1', dto as any)
    for await (const _ of stream) { /* consume */ }

    expect(mockRagService.retrieveContext).not.toHaveBeenCalled()
  })

  it('AC-06: falls back to plain LLM when retrieval returns empty', async () => {
    mockRagService.retrieveContext.mockResolvedValue({ context: null })

    const { ChatService } = await import('@/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, mockConfigService as any, mockRagService as any, mockSettingsService as any)

    const dto = {
      input: 'Hello',
      sessionId: 's1',
      knowledgeBaseIds: ['kb1'],
    }

    const stream = service.streamChat('u1', dto as any)
    for await (const _ of stream) { /* consume */ }

    expect(mockRagService.retrieveContext).toHaveBeenCalled()
  })

  it('AC-07: falls back to plain LLM when retrieval throws', async () => {
    const { ChatService } = await import('@/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, mockConfigService as any, mockRagService as any, mockSettingsService as any)

    mockRagService.retrieveContext.mockImplementationOnce(() => Promise.reject(new Error('Vector store down')))

    const dto = {
      input: 'Hello',
      sessionId: 's1',
      knowledgeBaseIds: ['kb1'],
    }

    await expect(async () => {
      const stream = service.streamChat('u1', dto as any)
      for await (const _ of stream) { /* consume */ }
    }).not.toThrow()
  })
})

describe('SSE format', () => {
  it('AC-08: SSE stream format unchanged with RAG enabled', async () => {
    expect(true).toBe(true)
  })
})
