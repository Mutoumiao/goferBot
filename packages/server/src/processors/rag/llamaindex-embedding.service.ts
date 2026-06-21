import { BaseEmbedding } from '@llamaindex/core/embeddings'
import { OpenAIEmbedding } from '@llamaindex/openai'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class LlamaIndexEmbeddingService {
  readonly model: BaseEmbedding

  constructor(private readonly config: ConfigService) {
    this.model = new OpenAIEmbedding({
      model: config.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small'),
      apiKey: config.getOrThrow<string>('EMBEDDING_API_KEY'),
      baseURL: config.get<string>('EMBEDDING_BASE_URL'),
      dimensions: config.get<number>('EMBEDDING_DIMENSIONS'),
    })
  }

  async embed(text: string): Promise<number[]> {
    return this.model.getTextEmbedding(text)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.model.getTextEmbeddings(texts)
  }
}
