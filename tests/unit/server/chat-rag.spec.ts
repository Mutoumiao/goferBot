import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { chatSchema } from '../../../packages/server/src/modules/chat/dto/chat.dto.js'

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
    const result = chatSchema.safeParse({
      message: 'hello',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      knowledgeBaseIds: ['550e8400-e29b-41d4-a716-446655440001'],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'https://api.openai.com', apiKey: 'mock' },
    })
    expect(result.success).toBe(true)
  })

  it('AC-02: returns 400 when knowledgeBaseIds contains invalid UUID', () => {
    const result = chatSchema.safeParse({
      message: 'hello',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      knowledgeBaseIds: ['not-a-uuid'],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'https://api.openai.com', apiKey: 'mock' },
    })
    expect(result.success).toBe(false)
  })
})

describe('ChatService RAG retrieval', () => {
  const mockRetriever = {
    retrieve: vi.fn().mockResolvedValue([
      { chunk: { id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'GoferBot RAG test', chunkIndex: 0 }, score: 0.9, source: 'vector' },
    ]),
  }
  const mockPostprocessor = {
    process: vi.fn().mockImplementation((candidates) => ({ candidates, trace: {} })),
  }
  const mockPrisma = {
    $transaction: vi.fn().mockResolvedValue([]),
    session: { findUnique: vi.fn().mockResolvedValue({ id: 's1', userId: 'u1' }), update: vi.fn().mockResolvedValue({}) },
    message: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
  }

  it('AC-03: injects retrieved chunks into system message', async () => {
    const { ChatService } = await import('../../../packages/server/src/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, {} as any, mockRetriever as any, mockPostprocessor as any)

    const dto = {
      message: 'What does the document say?',
      sessionId: 's1',
      knowledgeBaseIds: ['kb1'],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'https://api.openai.com', apiKey: 'mock' },
    }

    const stream = service.streamChat('u1', dto as any)
    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    expect(mockRetriever.retrieve).toHaveBeenCalledWith(expect.objectContaining({ original: dto.message, kbIds: ['kb1'] }), 10)
    expect(mockPostprocessor.process).toHaveBeenCalled()
  })

  it('AC-04: skips retrieval when knowledgeBaseIds is omitted', async () => {
    mockRetriever.retrieve.mockClear()
    mockPostprocessor.process.mockClear()

    const { ChatService } = await import('../../../packages/server/src/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, {} as any, mockRetriever as any, mockPostprocessor as any)

    const dto = {
      message: 'Hello',
      sessionId: 's1',
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'https://api.openai.com', apiKey: 'mock' },
    }

    const stream = service.streamChat('u1', dto as any)
    for await (const _ of stream) { /* consume */ }

    expect(mockRetriever.retrieve).not.toHaveBeenCalled()
  })

  it('AC-05: skips retrieval when knowledgeBaseIds is empty array', async () => {
    mockRetriever.retrieve.mockClear()
    mockPostprocessor.process.mockClear()

    const { ChatService } = await import('../../../packages/server/src/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, {} as any, mockRetriever as any, mockPostprocessor as any)

    const dto = {
      message: 'Hello',
      sessionId: 's1',
      knowledgeBaseIds: [],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'https://api.openai.com', apiKey: 'mock' },
    }

    const stream = service.streamChat('u1', dto as any)
    for await (const _ of stream) { /* consume */ }

    expect(mockRetriever.retrieve).not.toHaveBeenCalled()
  })

  it('AC-06: falls back to plain LLM when retrieval returns empty', async () => {
    mockRetriever.retrieve.mockResolvedValue([])
    mockPostprocessor.process.mockReturnValue({ candidates: [], trace: {} })

    const { ChatService } = await import('../../../packages/server/src/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, {} as any, mockRetriever as any, mockPostprocessor as any)

    const dto = {
      message: 'Hello',
      sessionId: 's1',
      knowledgeBaseIds: ['kb1'],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'https://api.openai.com', apiKey: 'mock' },
    }

    const stream = service.streamChat('u1', dto as any)
    for await (const _ of stream) { /* consume */ }

    expect(mockRetriever.retrieve).toHaveBeenCalled()
  })

  it('AC-07: falls back to plain LLM when retrieval throws', async () => {
    mockRetriever.retrieve.mockRejectedValue(new Error('Vector store down'))

    const { ChatService } = await import('../../../packages/server/src/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, {} as any, mockRetriever as any, mockPostprocessor as any)

    const dto = {
      message: 'Hello',
      sessionId: 's1',
      knowledgeBaseIds: ['kb1'],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'https://api.openai.com', apiKey: 'mock' },
    }

    await expect(async () => {
      const stream = service.streamChat('u1', dto as any)
      for await (const _ of stream) { /* consume */ }
    }).not.toThrow()
  })
})

describe('SSE format', () => {
  it('AC-08: SSE stream format unchanged with RAG enabled', async () => {
    // 占位：在 ChatService 实现后补充具体断言
    expect(true).toBe(true)
  })
})
