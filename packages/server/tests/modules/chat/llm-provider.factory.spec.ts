import { describe, expect, it } from 'vitest'
import { LlmProviderFactory } from '@/modules/chat/llm/llm-provider.factory.js'
import { LlamaIndexProvider } from '@/modules/chat/llm/llama-index-provider.service.js'

describe('LlmProviderFactory', () => {
  const factory = new LlmProviderFactory()

  it('creates LlamaIndex provider by default', () => {
    const provider = factory.create('llama-index', {
      apiKey: 'test-key',
      model: 'gpt-4',
      baseURL: 'https://api.openai.com',
      timeout: 30_000,
      customHeaders: { 'X-Custom': 'value' },
      organization: 'org-1',
    })

    expect(provider).toBeInstanceOf(LlamaIndexProvider)
    expect(provider.providerKey).toBe('llama-index')
    expect(provider.capabilities).toContain('streaming')
    expect(provider.capabilities).toContain('blocking')
  })

  it('defaults to LlamaIndex provider for unknown keys', () => {
    const provider = factory.create('unknown-provider', {
      apiKey: 'test-key',
      model: 'gpt-4',
    })

    expect(provider).toBeInstanceOf(LlamaIndexProvider)
    expect(provider.providerKey).toBe('llama-index')
  })
})
