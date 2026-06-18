import { describe, expect, it, vi } from 'vitest'
import { OpenAIEmbedder } from '@/embedders/openai.embedder.js'
import { EmbeddingError, ValidationError } from '@/errors.js'

const config = {
  provider: 'openai' as const,
  model: 'text-embedding-3-small',
  dimension: 3,
  apiKey: 'test-key',
  baseUrl: 'https://api.test.local/v1/embeddings',
}

function mockFetch(response: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(response),
    json: async () => response,
  })
}

describe('OpenAIEmbedder.embedWithUsage', () => {
  it('AC-06: returns vectors and usage for single text', async () => {
    globalThis.fetch = mockFetch({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
      usage: { prompt_tokens: 5 },
    })

    const embedder = new OpenAIEmbedder(config)
    const result = await embedder.embedWithUsage(['hello world'])

    expect(result.vectors).toHaveLength(1)
    expect(result.vectors[0]).toEqual([0.1, 0.2, 0.3])
    expect(result.usage).toHaveLength(1)
    expect(result.usage[0]).toEqual({ promptTokens: 5, totalTokens: 5 })
  })

  it('AC-07: returns vectors and usage for multiple texts', async () => {
    globalThis.fetch = mockFetch({
      data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
      usage: { prompt_tokens: 10 },
    })

    const embedder = new OpenAIEmbedder(config)
    const result = await embedder.embedWithUsage(['hello', 'world'])

    expect(result.vectors).toHaveLength(2)
    expect(result.usage).toHaveLength(2)
    expect(result.usage.reduce((s, u) => s + u.promptTokens, 0)).toBe(10)
  })

  it('AC-08: distributes total tokens proportionally by text length', async () => {
    globalThis.fetch = mockFetch({
      data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
      usage: { prompt_tokens: 100 },
    })

    const embedder = new OpenAIEmbedder(config)
    const result = await embedder.embedWithUsage(['a'.repeat(100), 'a'.repeat(300)])

    expect(result.usage[0].promptTokens).toBe(25)
    expect(result.usage[1].promptTokens).toBe(75)
    expect(result.usage.reduce((s, u) => s + u.promptTokens, 0)).toBe(100)
  })

  it('AC-09: handles missing usage field by returning zeros', async () => {
    globalThis.fetch = mockFetch({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    })

    const embedder = new OpenAIEmbedder(config)
    const result = await embedder.embedWithUsage(['hello'])

    expect(result.usage[0]).toEqual({ promptTokens: 0, totalTokens: 0 })
  })

  it('AC-10: throws ValidationError for empty array', async () => {
    globalThis.fetch = vi.fn()
    const embedder = new OpenAIEmbedder(config)
    await expect(embedder.embedWithUsage([])).rejects.toThrow(ValidationError)
  })

  it('AC-11: handles batching correctly', async () => {
    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          usage: { prompt_tokens: 3 },
        }),
      })
    })

    const embedder = new OpenAIEmbedder({ ...config, baseUrl: undefined })
    const result = await embedder.embedWithUsage(['hello'])
    expect(result.vectors).toHaveLength(1)
    expect(result.usage).toHaveLength(1)
    expect(callCount).toBe(1)
  })

  it('AC-12: distributes evenly when all texts are empty', async () => {
    globalThis.fetch = mockFetch({
      data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
      usage: { prompt_tokens: 10 },
    })

    const embedder = new OpenAIEmbedder(config)
    const result = await embedder.embedWithUsage(['', ''])

    expect(result.usage[0].promptTokens).toBe(5)
    expect(result.usage[1].promptTokens).toBe(5)
    expect(result.usage.reduce((s, u) => s + u.promptTokens, 0)).toBe(10)
  })

  it('AC-13: corrects rounding error to match total', async () => {
    globalThis.fetch = mockFetch({
      data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
      usage: { prompt_tokens: 7 },
    })

    const embedder = new OpenAIEmbedder(config)
    const result = await embedder.embedWithUsage(['a'.repeat(100), 'a'.repeat(100)])

    expect(result.usage.reduce((s, u) => s + u.promptTokens, 0)).toBe(7)
  })

  it('AC-14: throws EmbeddingError on API failure', async () => {
    globalThis.fetch = mockFetch({ error: 'bad request' }, 400)
    const embedder = new OpenAIEmbedder(config)
    await expect(embedder.embedWithUsage(['hello'])).rejects.toThrow(EmbeddingError)
  })

  it('AC-15: throws EmbeddingError on dimension mismatch', async () => {
    globalThis.fetch = mockFetch({
      data: [{ embedding: [0.1, 0.2] }], // dimension 2, config expects 3
      usage: { prompt_tokens: 1 },
    })
    const embedder = new OpenAIEmbedder(config)
    await expect(embedder.embedWithUsage(['hello'])).rejects.toThrow(EmbeddingError)
  })
})

describe('OpenAIEmbedder backward compatibility', () => {
  it('AC-19: embed() method signature and behavior remain unchanged', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 5 },
      }),
    })

    const embedder = new OpenAIEmbedder(config)
    const result = await embedder.embed(['hello'])

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual([0.1, 0.2, 0.3])
    // embed() 不返回 usage
    expect(Array.isArray(result)).toBe(true)
  })
})
