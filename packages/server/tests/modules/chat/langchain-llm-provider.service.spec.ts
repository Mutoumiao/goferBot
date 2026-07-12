import { describe, expect, it, vi } from 'vitest'
import { LangChainLlmProvider } from '@/modules/chat/llm/langchain-llm-provider.service.js'

describe('LangChainLlmProvider', () => {
  it('exposes langchain providerKey', () => {
    const model = {
      invoke: vi.fn(),
      stream: vi.fn(),
    }
    const provider = new LangChainLlmProvider(model)
    expect(provider.providerKey).toBe('langchain')
    expect(provider.capabilities).toContain('blocking')
  })

  it('invoke returns string content', async () => {
    const model = {
      invoke: vi.fn().mockResolvedValue({ content: '短标题' }),
      stream: vi.fn(),
    }
    const provider = new LangChainLlmProvider(model)
    const title = await provider.invoke([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'user' },
    ])
    expect(title).toBe('短标题')
    expect(model.invoke).toHaveBeenCalledOnce()
  })

  it('stream yields text chunks', async () => {
    async function* gen() {
      yield { content: '你' }
      yield { content: '好' }
    }
    const model = {
      invoke: vi.fn(),
      stream: vi.fn().mockReturnValue(gen()),
    }
    const provider = new LangChainLlmProvider(model)
    const parts: string[] = []
    for await (const c of provider.stream([{ role: 'user', content: 'hi' }])) {
      parts.push(c.text)
    }
    expect(parts.join('')).toBe('你好')
  })
})
