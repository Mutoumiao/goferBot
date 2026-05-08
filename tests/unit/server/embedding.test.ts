// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getEmbedding } = await import('../../../../server/src/services/embedding.js')

describe('getEmbedding', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns embeddings for multiple texts', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [0.1, 0.2, 0.3], index: 0 },
          { embedding: [0.4, 0.5, 0.6], index: 1 },
        ],
      }),
    } as Response)

    const result = await getEmbedding(['hello', 'world'], {
      provider: 'openai',
      model: 'text-embedding-3-small',
      baseUrl: '',
      apiKey: 'test-key',
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([0.1, 0.2, 0.3])
    expect(result[1]).toEqual([0.4, 0.5, 0.6])
  })

  it('throws on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response)

    await expect(
      getEmbedding(['hello'], {
        provider: 'openai',
        model: 'text-embedding-3-small',
        baseUrl: '',
        apiKey: 'bad-key',
      })
    ).rejects.toThrow('Embedding API error: 401')
  })

  it('throws on unknown provider without baseUrl', async () => {
    await expect(
      getEmbedding(['hello'], {
        provider: 'unknown',
        model: 'x',
        baseUrl: '',
        apiKey: 'key',
      })
    ).rejects.toThrow('Unknown embedding provider')
  })
})
