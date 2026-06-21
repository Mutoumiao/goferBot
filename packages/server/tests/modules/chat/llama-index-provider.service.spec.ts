import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LlamaIndexProvider } from '@/modules/chat/llm/llama-index-provider.service.js'

const mockChat = vi.fn()

vi.mock('@llamaindex/openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: mockChat,
  })),
}))

describe('LlamaIndexProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns provider key and capabilities', () => {
    const provider = new LlamaIndexProvider({ apiKey: 'key', model: 'gpt-4' })

    expect(provider.providerKey).toBe('llama-index')
    expect(provider.capabilities).toEqual(['streaming', 'blocking'])
  })

  it('streams text chunks', async () => {
    mockChat.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { delta: 'hello' }
        yield { delta: ' world' }
      },
    })

    const provider = new LlamaIndexProvider({ apiKey: 'key', model: 'gpt-4' })
    const chunks: string[] = []

    for await (const chunk of provider.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk.text)
    }

    expect(chunks).toEqual(['hello', ' world'])
  })

  it('skips empty chunks', async () => {
    mockChat.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { delta: '' }
        yield { delta: 'hi' }
        yield { delta: '' }
      },
    })

    const provider = new LlamaIndexProvider({ apiKey: 'key', model: 'gpt-4' })
    const chunks: string[] = []

    for await (const chunk of provider.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk.text)
    }

    expect(chunks).toEqual(['hi'])
  })

  it('handles non-iterable stream response gracefully', async () => {
    mockChat.mockResolvedValue(null)

    const provider = new LlamaIndexProvider({ apiKey: 'key', model: 'gpt-4' })
    const chunks: string[] = []

    for await (const chunk of provider.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk.text)
    }

    expect(chunks).toEqual([])
  })

  it('returns text from invoke', async () => {
    mockChat.mockResolvedValue({
      message: { content: 'hello world' },
    })

    const provider = new LlamaIndexProvider({ apiKey: 'key', model: 'gpt-4' })
    const result = await provider.invoke([{ role: 'user', content: 'hi' }])

    expect(result).toBe('hello world')
  })

  it('handles array content from invoke', async () => {
    mockChat.mockResolvedValue({
      message: {
        content: [{ text: 'hello' }, { text: ' world' }],
      },
    })

    const provider = new LlamaIndexProvider({ apiKey: 'key', model: 'gpt-4' })
    const result = await provider.invoke([{ role: 'user', content: 'hi' }])

    expect(result).toBe('hello world')
  })

  it('passes messages with role mapping to chat', async () => {
    mockChat.mockResolvedValue({ message: { content: 'ok' } })

    const provider = new LlamaIndexProvider({ apiKey: 'key', model: 'gpt-4' })
    await provider.invoke([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ])

    expect(mockChat).toHaveBeenCalledWith({
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
    })
  })

  it('passes messages with stream flag to chat', async () => {
    mockChat.mockResolvedValue({
      async *[Symbol.asyncIterator]() {},
    })

    const provider = new LlamaIndexProvider({ apiKey: 'key', model: 'gpt-4' })
    // consume
    for await (const _ of provider.stream([{ role: 'user', content: 'hi' }])) {
      /* noop */
    }

    expect(mockChat).toHaveBeenCalledWith({
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    })
  })
})
