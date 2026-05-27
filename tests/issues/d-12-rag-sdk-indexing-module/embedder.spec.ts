import { describe, it, expect, vi } from 'vitest'
import { OpenAIEmbedder } from '../../../packages/rag-sdk/src/embedders/openai.embedder.js'
import { ValidationError, EmbeddingError } from '../../../packages/rag-sdk/src/errors.js'

describe('OpenAIEmbedder', () => {
  it('AC-02: throws ValidationError for empty texts array', async () => {
    const embedder = new OpenAIEmbedder({
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimension: 1536,
      apiKey: 'test-key',
    })
    await expect(embedder.embed([])).rejects.toThrow(ValidationError)
  })

  it('AC-02: embeds texts in batches and returns correct dimensions', async () => {
    const embedder = new OpenAIEmbedder({
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimension: 3,
      apiKey: 'test-key',
      baseUrl: 'http://localhost:9999',
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [0.1, 0.2, 0.3] },
          { embedding: [0.4, 0.5, 0.6] },
        ],
      }),
    } as any)

    const result = await embedder.embed(['hello', 'world'])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([0.1, 0.2, 0.3])
    expect(result[1]).toEqual([0.4, 0.5, 0.6])
  })

  it('AC-02: throws EmbeddingError on API failure with cause', async () => {
    const embedder = new OpenAIEmbedder({
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimension: 3,
      apiKey: 'test-key',
      baseUrl: 'http://localhost:9999',
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    } as any)

    await expect(embedder.embed(['hello'])).rejects.toThrow(EmbeddingError)
  })
})
