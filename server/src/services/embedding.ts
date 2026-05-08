import type { LLMConfig } from '../types.js'

export interface EmbeddingConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
}

function getDefaultEmbeddingBaseUrl(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com'
    case 'siliconflow':
      return 'https://api.siliconflow.cn'
    default:
      return ''
  }
}

export async function getEmbedding(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
  const url = config.baseUrl || getDefaultEmbeddingBaseUrl(config.provider)
  if (!url) {
    throw new Error(`Unknown embedding provider: ${config.provider}`)
  }

  const response = await fetch(`${url}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: texts,
      encoding_format: 'float',
    }),
  })

  if (!response.ok) {
    const error = await response.text().catch(() => 'Unknown error')
    throw new Error(`Embedding API error: ${response.status} ${error}`)
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>
  }

  const sorted = data.data.sort((a, b) => a.index - b.index)
  return sorted.map((d) => d.embedding)
}
