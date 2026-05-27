import { describe, it, expect } from 'vitest'
import { reciprocalRankFusion } from '../../../packages/rag-sdk/src/runtime/rrf.js'
import type { RetrievalCandidate } from '../../../packages/rag-sdk/src/types.js'

describe('reciprocalRankFusion', () => {
  const makeCandidate = (id: string, score: number, source: any): RetrievalCandidate =>
    ({
      chunk: { id, documentId: 'd1', kbId: 'k1', content: 'test', chunkIndex: 0 } as any,
      score,
      source,
    })

  it('AC-03: fuses vector and keyword results with RRF', () => {
    const vectorResults = [
      makeCandidate('a', 0.9, 'vector'),
      makeCandidate('b', 0.8, 'vector'),
    ]
    const keywordResults = [
      makeCandidate('b', 0.85, 'keyword'),
      makeCandidate('c', 0.7, 'keyword'),
    ]

    const fused = reciprocalRankFusion([vectorResults, keywordResults], 60)
    expect(fused.length).toBe(3)
    expect(fused[0].source).toBe('hybrid')
    expect(fused[0].chunk.id).toBe('b')
  })

  it('AC-03: handles empty result lists', () => {
    const fused = reciprocalRankFusion([], 60)
    expect(fused).toEqual([])
  })

  it('AC-03: handles single list', () => {
    const list = [makeCandidate('a', 0.9, 'vector')]
    const fused = reciprocalRankFusion([list], 60)
    expect(fused).toHaveLength(1)
    expect(fused[0].chunk.id).toBe('a')
  })
})
