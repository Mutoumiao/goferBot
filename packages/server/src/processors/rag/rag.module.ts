import { Module } from '@nestjs/common'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { SettingsModule } from '../../modules/settings/settings.module.js'
import { QueueModule } from '../queue/queue.module.js'
import { BgeRerankService } from './bge-rerank.service.js'
import { ElasticsearchService } from './elasticsearch.service.js'
import { EsFilterBuilder } from './es-filter.builder.js'
import { EsKeywordService } from './es-keyword.service.js'
import { EsVectorService } from './es-vector.service.js'
import { GroundingService } from './grounding.service.js'
import { GuardrailService } from './guardrail.service.js'
import { DocumentUploadedListener } from './listeners/document-uploaded.listener.js'
import { LlamaIndexEmbeddingService } from './llamaindex-embedding.service.js'
import { LlamaIndexRagService } from './llamaindex-rag.service.js'
import { QueryUnderstandingService } from './query-understanding.service.js'
import { RagController } from './rag.controller.js'
import { RouterService } from './router.service.js'

@Module({
  imports: [SettingsModule, QueueModule],
  controllers: [RagController],
  providers: [
    LlamaIndexEmbeddingService,
    ElasticsearchService,
    EsFilterBuilder,
    EsKeywordService,
    EsVectorService,
    BgeRerankService,
    GroundingService,
    GuardrailService,
    RouterService,
    LlamaIndexRagService,
    QueryUnderstandingService,
    SseResponseHelper,
    DocumentUploadedListener,
  ],
  exports: [
    ElasticsearchService,
    EsFilterBuilder,
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
