import { describe, it, expect } from 'vitest'
import type { IEmbedder, IIndexer } from '../../../packages/rag-sdk/src/interfaces.js'
import type { TokenUsage, EmbedWithUsageResult, Chunk } from '../../../packages/rag-sdk/src/types.js'

describe('TokenUsage types', () => {
  it('AC-01: TokenUsage type has promptTokens and totalTokens', () => {
    // 编译期检查：确保类型存在且可导入
    // 运行时用一个符合结构的对象验证
    const usage: import('../../../packages/rag-sdk/src/types.js').TokenUsage = {
      promptTokens: 10,
      totalTokens: 10,
    }
    expect(usage.promptTokens).toBe(10)
    expect(usage.totalTokens).toBe(10)
  })

  it('AC-02: EmbedWithUsageResult type has vectors and usage arrays', () => {
    const result: import('../../../packages/rag-sdk/src/types.js').EmbedWithUsageResult = {
      vectors: [[0.1, 0.2]],
      usage: [{ promptTokens: 5, totalTokens: 5 }],
    }
    expect(result.vectors).toHaveLength(1)
    expect(result.usage).toHaveLength(1)
  })
})

describe('IEmbedder interface', () => {
  it('AC-03: IEmbedder allows optional embedWithUsage method', () => {
    // 编译期检查：构造一个满足接口的最小对象
    const embedder: IEmbedder = {
      embed: async (_texts: string[]) => [],
      embedWithUsage: async (_texts: string[]): Promise<EmbedWithUsageResult> => ({
        vectors: [],
        usage: [],
      }),
      config: { provider: 'openai', model: 'text-embedding-3-small', dimension: 1536, apiKey: 'test' },
    }
    expect(embedder.embedWithUsage).toBeDefined()
  })

  it('AC-04: IEmbedder embed method signature remains unchanged', () => {
    const embedder: IEmbedder = {
      embed: async (_texts: string[]) => [],
      config: { provider: 'openai', model: 'text-embedding-3-small', dimension: 1536, apiKey: 'test' },
    }
    expect(embedder.embed).toBeDefined()
    expect(embedder.embedWithUsage).toBeUndefined()
  })
})

describe('IIndexer interface', () => {
  it('AC-05: IIndexer index method accepts optional usage parameter', () => {
    const indexer: IIndexer = {
      index: async (_chunks: Chunk[], _vectors: number[][], _usage?: TokenUsage[]) => {},
    }
    expect(indexer.index).toBeDefined()
  })
})
