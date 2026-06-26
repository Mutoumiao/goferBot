import { DefaultRetrievalPostprocessor, HybridRetriever, OpenAIEmbedder } from '@goferbot/rag-sdk'
import { Module } from '@nestjs/common'
import { KeywordService } from '../../processors/keyword/keyword.service.js'
import { VectorService } from '../../processors/vector/vector.service.js'
import { ModelProviderService } from '../settings/model-provider.service.js'
import { SettingsModule } from '../settings/settings.module.js'
import { SystemConfigService } from '../settings/system-config.service.js'
import { RagService } from './rag.service.js'

/**
 * FROZEN: 本项目 chat 暂不接入 RAG，模块仅作代码隔离。
 * 不暴露任何 HTTP Controller，不依赖 ChatModule，也不被 ChatModule 依赖。
 */
@Module({
  imports: [SettingsModule],
  providers: [
    RagService,
    {
      provide: HybridRetriever,
      useFactory: async (
        vectorService: VectorService,
        keywordService: KeywordService,
        systemConfigService: SystemConfigService,
        modelProviderService: ModelProviderService,
      ) => {
        const config = await systemConfigService.getDecryptedSystemConfig()
        const provider = modelProviderService.resolveProvider(
          'rag.embeddingProvider',
          'embedding',
          config,
        )
        const embedder = new OpenAIEmbedder({
          provider: provider.id,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl || undefined,
          model: provider.model,
          dimension: provider.dimensions ?? 1536,
        })
        return new HybridRetriever({
          vectorStore: vectorService,
          keywordStore: keywordService,
          embedder,
        })
      },
      inject: [VectorService, KeywordService, SystemConfigService, ModelProviderService],
    },
    {
      provide: DefaultRetrievalPostprocessor,
      useValue: new DefaultRetrievalPostprocessor({
        minScore: 0,
        maxChunks: 10,
        tokenBudget: 3000,
      }),
    },
  ],
  exports: [RagService],
})
export class RagModule {}
