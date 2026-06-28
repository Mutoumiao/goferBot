import { Module } from '@nestjs/common'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { SettingsModule } from '../../modules/settings/settings.module.js'
import { BgeRerankService } from './bge-rerank.service.js'
import { ElasticsearchService } from './elasticsearch.service.js'
import { EsKeywordService } from './es-keyword.service.js'
import { EsVectorService } from './es-vector.service.js'
import { GroundingService } from './grounding.service.js'
import { GuardrailService } from './guardrail.service.js'
import { LlamaIndexEmbeddingService } from './llamaindex-embedding.service.js'
import { LlamaIndexRagService } from './llamaindex-rag.service.js'
import { QueryUnderstandingService } from './query-understanding.service.js'
import { RagController } from './rag.controller.js'
import { RouterService } from './router.service.js'

@Module({
  imports: [SettingsModule],
  controllers: [RagController],
  providers: [
    LlamaIndexEmbeddingService,
    ElasticsearchService,
    EsKeywordService,
    EsVectorService,
    BgeRerankService,
    GroundingService,
    GuardrailService,
    RouterService,
    LlamaIndexRagService,
    QueryUnderstandingService,
    SseResponseHelper,
  ],
  exports: [
    ElasticsearchService,
    EsKeywordService,
    EsVectorService,
    BgeRerankService,
    GroundingService,
    GuardrailService,
    RouterService,
    LlamaIndexRagService,
    QueryUnderstandingService,
  ],
})
export class RagModule {}
