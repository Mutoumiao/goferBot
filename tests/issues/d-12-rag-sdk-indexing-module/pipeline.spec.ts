import { describe, it, expect, vi } from 'vitest'
import { runIndexing } from '../../../packages/rag-sdk/src/pipelines/run-indexing.js'
import { RecursiveCharacterChunker } from '../../../packages/rag-sdk/src/chunkers/recursive-character.chunker.js'
import { EmbeddingError } from '../../../packages/rag-sdk/src/errors.js'
import type { IEmbedder, IIndexer } from '../../../packages/rag-sdk/src/interfaces.js'

describe('runIndexing', () => {
  const doc = {
    documentId: '550e8400-e29b-41d4-a716-446655440000',
    kbId: '550e8400-e29b-41d4-a716-446655440001',
    content: 'hello world this is a test document',
    mimeType: 'text/plain',
  }

  it('AC-04: completes all stages and returns IndexingResult', async () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 10, chunkOverlap: 2 })
    const embedder: IEmbedder = {
      embed: vi.fn().mockImplementation((texts: string[]) =>
        Promise.resolve(texts.map(() => [0.1])),
      ),
      config: { provider: 'test', model: 'test', dimension: 1, apiKey: 'test' },
    }
    const indexer: IIndexer = {
      index: vi.fn().mockResolvedValue(undefined),
    }

    const result = await runIndexing(doc, { chunker, embedder, indexer })
    expect(result.chunks.length).toBeGreaterThan(0)
    expect(result.vectorCount).toBe(result.chunks.length)
    expect(result.stages).toHaveLength(3)
    expect(result.stages.every(s => s.status === 'completed')).toBe(true)
  })

  it('AC-04: tracks stage status through pending/running/completed', async () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 10, chunkOverlap: 2 })
    const embedder: IEmbedder = {
      embed: vi.fn().mockImplementation((texts: string[]) =>
        Promise.resolve(texts.map(() => [0.1])),
      ),
      config: { provider: 'test', model: 'test', dimension: 1, apiKey: 'test' },
    }
    const indexer: IIndexer = { index: vi.fn().mockResolvedValue(undefined) }
    const stageSnapshots: any[] = []

    await runIndexing(doc, {
      chunker, embedder, indexer,
      onStageChange: (stages) => stageSnapshots.push(JSON.parse(JSON.stringify(stages))),
    })

    expect(stageSnapshots.length).toBeGreaterThanOrEqual(6)
    expect(stageSnapshots[0][0].status).toBe('running')
    expect(stageSnapshots[0][1].status).toBe('pending')
  })

  it('AC-04: stops at failed stage and leaves subsequent stages pending', async () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 10, chunkOverlap: 2 })
    const embedder: IEmbedder = {
      embed: vi.fn().mockRejectedValue(new EmbeddingError('fail')),
      config: { provider: 'test', model: 'test', dimension: 1, apiKey: 'test' },
    }
    const indexer: IIndexer = { index: vi.fn().mockResolvedValue(undefined) }
    const stageSnapshots: any[] = []

    await expect(runIndexing(doc, {
      chunker, embedder, indexer,
      onStageChange: (stages) => stageSnapshots.push(JSON.parse(JSON.stringify(stages))),
    })).rejects.toThrow()

    const failedStage = stageSnapshots.find(s => s.some((st: any) => st.status === 'failed'))
    expect(failedStage).toBeDefined()
  })
})
