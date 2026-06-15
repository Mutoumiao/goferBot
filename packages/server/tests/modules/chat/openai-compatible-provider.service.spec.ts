import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAiCompatibleProvider } from '@/modules/chat/llm/openai-compatible-provider.service.js'

const mockStream = vi.fn()
const mockInvoke = vi.fn()

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    stream: mockStream,
    invoke: mockInvoke,
  })),
}))

describe('OpenAiCompatibleProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns provider key and capabilities', () => {
    const provider = new OpenAiCompatibleProvider({ apiKey: 'key', model: 'gpt-4' })

    expect(provider.providerKey).toBe('openai-compatible')
    expect(provider.capabilities).toEqual(['streaming', 'blocking'])
  })

  it('streams text chunks', async () => {
    mockStream.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { content: 'hello' }
        yield { content: ' world' }
      },
    })

    const provider = new OpenAiCompatibleProvider({ apiKey: 'key', model: 'gpt-4' })
    const chunks: string[] = []

    for await (const chunk of provider.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk.text)
    }

    expect(chunks).toEqual(['hello', ' world'])
  })

  it('skips empty chunks', async () => {
    mockStream.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { content: '' }
        yield { content: 'hi' }
        yield { content: null }
      },
    })

    const provider = new OpenAiCompatibleProvider({ apiKey: 'key', model: 'gpt-4' })
    const chunks: string[] = []

    for await (const chunk of provider.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk.text)
    }

    expect(chunks).toEqual(['hi'])
  })

  it('handles array content chunks', async () => {
    mockStream.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { content: [{ text: 'hello' }, { text: ' world' }] }
      },
    })

    const provider = new OpenAiCompatibleProvider({ apiKey: 'key', model: 'gpt-4' })
    const chunks: string[] = []

    for await (const chunk of provider.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk.text)
    }

    expect(chunks).toEqual(['hello world'])
  })

  it('returns text from invoke', async () => {
    mockInvoke.mockResolvedValue({ content: 'hello world' })

    const provider = new OpenAiCompatibleProvider({ apiKey: 'key', model: 'gpt-4' })
    const result = await provider.invoke([{ role: 'user', content: 'hi' }])

    expect(result).toBe('hello world')
  })

  it('handles array content from invoke', async () => {
    mockInvoke.mockResolvedValue({ content: [{ text: 'hello' }, { text: ' world' }] })

    const provider = new OpenAiCompatibleProvider({ apiKey: 'key', model: 'gpt-4' })
    const result = await provider.invoke([{ role: 'user', content: 'hi' }])

    expect(result).toBe('hello world')
  })

  it('passes abort signal to stream', async () => {
    mockStream.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { content: 'x' }
      },
    })

    const provider = new OpenAiCompatibleProvider({ apiKey: 'key', model: 'gpt-4' })
    const controller = new AbortController()

    for await (const _ of provider.stream([{ role: 'user', content: 'hi' }], { abortSignal: controller.signal })) {
      // consume
    }

    expect(mockStream).toHaveBeenCalledWith(expect.any(Array), { signal: controller.signal })
  })
})
