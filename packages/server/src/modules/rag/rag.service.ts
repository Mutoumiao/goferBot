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

  constructor() {}

  async retrieveContext(_query: RetrievalQuery): Promise<RetrievalResult> {
    this.logger.warn('RagService.retrieveContext is deprecated and always returns null context')
    return { context: null }
  }
}
