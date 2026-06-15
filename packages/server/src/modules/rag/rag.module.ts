import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RagService } from './rag.service.js'
import { HybridRetriever, DefaultRetrievalPostprocessor, OpenAIEmbedder } from '@goferbot/rag-sdk'
import { VectorService } from '../../processors/vector/vector.service.js'
import { KeywordService } from '../../processors/keyword/keyword.service.js'

/**
 * FROZEN: 本项目 chat 暂不接入 RAG，模块仅作代码隔离。
 * 不暴露任何 HTTP Controller，不依赖 ChatModule，也不被 ChatModule 依赖。
 */
@Module({
  providers: [
    RagService,
    {
      provide: HybridRetriever,
      useFactory: (vectorService: VectorService, keywordService: KeywordService, config: ConfigService) => {
        const embedder = new OpenAIEmbedder({
          provider: 'openai',
          apiKey: config.getOrThrow<string>('EMBEDDING_API_KEY'),
          baseUrl: config.get<string>('EMBEDDING_BASE_URL') ?? undefined,
          model: config.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small'),
          dimension: config.get<number>('EMBEDDING_DIMENSIONS', 1536),
        })
        return new HybridRetriever({
          vectorStore: vectorService,
          keywordStore: keywordService,
          embedder,
        })
      },
      inject: [VectorService, KeywordService, ConfigService],
    },
    {
      provide: DefaultRetrievalPostprocessor,
      useValue: new DefaultRetrievalPostprocessor({ minScore: 0, maxChunks: 10, tokenBudget: 3000 }),
    },
  ],
  exports: [RagService],
})
export class RagModule {}
