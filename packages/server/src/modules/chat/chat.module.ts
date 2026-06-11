import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChatController } from './chat.controller.js'
import { ChatService } from './chat.service.js'
import { RagService } from './rag.service.js'
import { HybridRetriever, DefaultRetrievalPostprocessor, OpenAIEmbedder } from '@goferbot/rag-sdk'
import { VectorService } from '../../processors/vector/vector.service.js'
import { KeywordService } from '../../processors/keyword/keyword.service.js'
import { SettingsModule } from '../settings/settings.module.js'

@Module({
  imports: [SettingsModule],
  controllers: [ChatController],
  providers: [
    ChatService,
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
})
export class ChatModule {}
