import { describe, it, expect, vi } from 'vitest'
import { runIndexing } from '@/pipelines/run-indexing.js'
import type { IChunker, IEmbedder, IIndexer } from '@/interfaces.js'
import type { DocumentSource, Chunk, TokenUsage } from '@/types.js'

const document: DocumentSource = {
  documentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  kbId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  content: 'Hello world. This is a test document.',
  mimeType: 'text/plain',
}

function makeChunk(content: string, index: number): Chunk {
  return {
    id: `chunk-${index}`,
    documentId: document.documentId,
    kbId: document.kbId,
    content,
    chunkIndex: index,
  }
}

describe('runIndexing with embedWithUsage', () => {
  it('AC-16: passes usage to indexer when embedder supports embedWithUsage', async () => {
    const chunks = [makeChunk('Hello world', 0), makeChunk('This is a test', 1)]
    const vectors = [[0.1, 0.2], [0.3, 0.4]]
    const usage: TokenUsage[] = [
      { promptTokens: 2, totalTokens: 2 },
      { promptTokens: 3, totalTokens: 3 },
    ]

    const chunker: IChunker = { chunk: vi.fn().mockResolvedValue(chunks) }
    const embedder: IEmbedder = {
      config: { provider: 'openai', model: 'test', dimension: 2, apiKey: 'key' },
      embed: vi.fn(),
      embedWithUsage: vi.fn().mockResolvedValue({ vectors, usage }),
    }
    const indexer: IIndexer = { index: vi.fn().mockResolvedValue(undefined) }

    const result = await runIndexing(document, { chunker, embedder, indexer })

    expect(embedder.embedWithUsage).toHaveBeenCalledWith(chunks.map(c => c.content))
    expect(embedder.embed).not.toHaveBeenCalled()
    expect(indexer.index).toHaveBeenCalledWith(chunks, vectors, usage)
    expect(result.stages[1].status).toBe('completed')
    expect(result.stages[2].status).toBe('completed')
  })

  it('AC-17: falls back to embed when embedder lacks embedWithUsage', async () => {
    const chunks = [makeChunk('Hello world', 0)]
    const vectors = [[0.1, 0.2]]

    const chunker: IChunker = { chunk: vi.fn().mockResolvedValue(chunks) }
    const embedder: IEmbedder = {
      config: { provider: 'openai', model: 'test', dimension: 2, apiKey: 'key' },
      embed: vi.fn().mockResolvedValue(vectors),
    }
    const indexer: IIndexer = { index: vi.fn().mockResolvedValue(undefined) }

    const result = await runIndexing(document, { chunker, embedder, indexer })

    expect(embedder.embed).toHaveBeenCalledWith(chunks.map(c => c.content))
    expect(indexer.index).toHaveBeenCalledWith(chunks, vectors, undefined)
    expect(result.stages[1].status).toBe('completed')
  })

  it('AC-18: still works when indexer ignores usage', async () => {
    const chunks = [makeChunk('Hello world', 0)]
    const vectors = [[0.1, 0.2]]
    const usage: TokenUsage[] = [{ promptTokens: 2, totalTokens: 2 }]

    const chunker: IChunker = { chunk: vi.fn().mockResolvedValue(chunks) }
    const embedder: IEmbedder = {
      config: { provider: 'openai', model: 'test', dimension: 2, apiKey: 'key' },
      embed: vi.fn(),
      embedWithUsage: vi.fn().mockResolvedValue({ vectors, usage }),
    }
    // indexer 只接受 2 个参数（旧签名），验证不报错
    const indexer = { index: vi.fn().mockResolvedValue(undefined) } as unknown as IIndexer

    await runIndexing(document, { chunker, embedder, indexer })
    expect(indexer.index).toHaveBeenCalledWith(chunks, vectors, usage)
  })
})
