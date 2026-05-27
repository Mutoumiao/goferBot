import { describe, it, expect } from 'vitest'

describe('indexing exports', () => {
  it('AC-05: exports all indexing modules from indexing/index.ts', async () => {
    const indexing = await import('../../../packages/rag-sdk/src/indexing/index.js')
    expect(indexing.RecursiveCharacterChunker).toBeDefined()
    expect(indexing.OpenAIEmbedder).toBeDefined()
    expect(indexing.MilvusIndexer).toBeDefined()
    expect(indexing.runIndexing).toBeDefined()
  })

  it('AC-05: exports all indexing modules from root index.ts', async () => {
    const root = await import('../../../packages/rag-sdk/src/index.js')
    expect(root.RecursiveCharacterChunker).toBeDefined()
    expect(root.OpenAIEmbedder).toBeDefined()
    expect(root.MilvusIndexer).toBeDefined()
    expect(root.runIndexing).toBeDefined()
  })
})
