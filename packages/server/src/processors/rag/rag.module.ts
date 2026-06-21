import { Module } from '@nestjs/common'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { LlamaIndexEmbeddingService } from './llamaindex-embedding.service.js'
import { ElasticsearchService } from './elasticsearch.service.js'
import { EsKeywordService } from './es-keyword.service.js'
import { EsVectorService } from './es-vector.service.js'
import { BgeRerankService } from './bge-rerank.service.js'
import { GroundingService } from './grounding.service.js'
import { LlamaIndexRagService } from './llamaindex-rag.service.js'
import { QueryUnderstandingService } from './query-understanding.service.js'
import { RagController } from './rag.controller.js'

@Module({
  controllers: [RagController],
  providers: [
    LlamaIndexEmbeddingService,
    ElasticsearchService,
    EsKeywordService,
    EsVectorService,
    BgeRerankService,
    GroundingService,
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
    LlamaIndexRagService,
    QueryUnderstandingService,
  ],
})
export class RagModule { }
