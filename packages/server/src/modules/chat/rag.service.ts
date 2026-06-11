import { Injectable, Logger } from '@nestjs/common'
import { HybridRetriever, DefaultRetrievalPostprocessor } from '@goferbot/rag-sdk'

interface RetrievalResult {
  context: string | null
}

interface RetrievalQuery {
  original: string
  kbIds: string[]
}

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
