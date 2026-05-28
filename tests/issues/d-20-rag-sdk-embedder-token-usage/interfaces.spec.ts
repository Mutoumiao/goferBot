import { describe, it, expect } from 'vitest'

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
