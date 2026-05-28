import type { EmbeddingConfig, TokenUsage, EmbedWithUsageResult } from '../types.js'
import { EmbeddingError, ValidationError } from '../errors.js'

export class OpenAIEmbedder {
  readonly config: Readonly<EmbeddingConfig>

  constructor(config: EmbeddingConfig) {
    this.config = Object.freeze({ ...config })
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      throw new ValidationError('texts array must not be empty')
    }

    const batchSize = 100
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchResults = await this.embedBatch(batch)
      results.push(...batchResults)
    }

    for (const vec of results) {
      if (vec.length !== this.config.dimension) {
        throw new EmbeddingError(
          `Expected dimension ${this.config.dimension}, got ${vec.length}`
        )
      }
    }

    return results
  }

  async embedWithUsage(texts: string[]): Promise<EmbedWithUsageResult> {
    if (texts.length === 0) {
      throw new ValidationError('texts array must not be empty')
    }

    const batchSize = 100
    const results: number[][] = []
    const usages: TokenUsage[] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const { vectors, usage } = await this.embedBatchWithUsage(batch)
      results.push(...vectors)
      usages.push(...usage)
    }

    for (const vec of results) {
      if (vec.length !== this.config.dimension) {
        throw new EmbeddingError(
          `Expected dimension ${this.config.dimension}, got ${vec.length}`
        )
      }
    }

    return { vectors: results, usage: usages }
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const url = this.config.baseUrl ?? 'https://api.openai.com/v1/embeddings'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new EmbeddingError(`Embedding API error: ${response.status} ${text}`,
        new Error(text))
    }

    const data = await response.json()
    return data.data.map((item: { embedding: number[] }) => item.embedding)
  }

  private async embedBatchWithUsage(texts: string[]): Promise<EmbedWithUsageResult> {
    const url = this.config.baseUrl ?? 'https://api.openai.com/v1/embeddings'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new EmbeddingError(`Embedding API error: ${response.status} ${text}`,
        new Error(text))
    }

    const data = await response.json()
    const vectors: number[][] = data.data.map((item: { embedding: number[] }) => item.embedding)

    const totalTokens = data.usage?.prompt_tokens ?? 0
    const totalLength = texts.reduce((sum, t) => sum + t.length, 0)

    let usage: TokenUsage[]
    if (totalTokens === 0) {
      usage = texts.map(() => ({ promptTokens: 0, totalTokens: 0 }))
    } else if (totalLength === 0) {
      const avg = Math.round(totalTokens / texts.length)
      usage = texts.map(() => ({ promptTokens: avg, totalTokens: avg }))
    } else {
      usage = texts.map(text => {
        const promptTokens = Math.round((text.length / totalLength) * totalTokens)
        return { promptTokens, totalTokens: promptTokens }
      })
    }

    const distributedSum = usage.reduce((sum, u) => sum + u.promptTokens, 0)
    const diff = totalTokens - distributedSum
    if (diff !== 0 && usage.length > 0) {
      usage[usage.length - 1].promptTokens += diff
      usage[usage.length - 1].totalTokens += diff
    }

    return { vectors, usage }
  }
}
