import { Module } from '@nestjs/common'
import { RagService } from './rag.service.js'

/**
 * FROZEN: 本项目 chat 暂不接入 RAG，模块仅作代码隔离。
 * 不暴露任何 HTTP Controller，不依赖 ChatModule，也不被 ChatModule 依赖。
 */
@Module({
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
