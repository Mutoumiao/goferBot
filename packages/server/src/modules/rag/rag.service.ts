import { DefaultRetrievalPostprocessor, HybridRetriever } from '@goferbot/rag-sdk'
import { Injectable, Logger } from '@nestjs/common'

export interface RetrievalResult {
  context: string | null
}

export interface RetrievalQuery {
  original: string
  kbIds: string[]
}

/**
 * FROZEN: 本项目 chat 暂不接入 RAG，模块仅作代码隔离。
 * 保留 retrieveContext 方法签名与构造逻辑，降低未来接入成本。
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name)

  constructor(
    private readonly retriever: HybridRetriever,
    private readonly postprocessor: DefaultRetrievalPostprocessor,
  ) {}

  async retrieveContext(query: RetrievalQuery): Promise<RetrievalResult> {
    try {
      const candidates = await this.retriever.retrieve(query, 10)
      const processed = await this.postprocessor.process(candidates, query)

      const validCandidates = processed.candidates.filter(
        (c) => c.chunk.content && c.chunk.content.trim().length > 0,
      )

      if (validCandidates.length === 0) {
        return { context: null }
      }

      const context = validCandidates.map((c) => c.chunk.content).join('\n---\n')
      return { context }
    } catch (err) {
      this.logger.warn(`Retrieval failed: ${err instanceof Error ? err.message : String(err)}`)
      return { context: null }
    }
  }
}
