import { describe, expect, it } from 'vitest'
import { LlmProviderFactory } from '@/modules/chat/llm/llm-provider.factory.js'
import { OpenAiCompatibleProvider } from '@/modules/chat/llm/openai-compatible-provider.service.js'

describe('LlmProviderFactory', () => {
  const factory = new LlmProviderFactory()

  it('creates OpenAI-compatible provider', () => {
    const provider = factory.create('openai-compatible', {
      apiKey: 'test-key',
      model: 'gpt-4',
      baseURL: 'https://api.openai.com',
      timeout: 30_000,
      customHeaders: { 'X-Custom': 'value' },
      organization: 'org-1',
    })

    expect(provider).toBeInstanceOf(OpenAiCompatibleProvider)
    expect(provider.providerKey).toBe('openai-compatible')
    expect(provider.capabilities).toContain('streaming')
    expect(provider.capabilities).toContain('blocking')
  })

  it('defaults to OpenAI-compatible provider for unknown keys', () => {
    const provider = factory.create('unknown-provider', {
      apiKey: 'test-key',
      model: 'gpt-4',
    })

    expect(provider).toBeInstanceOf(OpenAiCompatibleProvider)
    expect(provider.providerKey).toBe('openai-compatible')
  })
})
