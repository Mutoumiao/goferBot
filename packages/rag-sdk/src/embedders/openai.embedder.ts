import type { EmbeddingConfig } from '../types.js'
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
}
