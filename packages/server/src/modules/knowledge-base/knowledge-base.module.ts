import { Module } from '@nestjs/common'
import { KnowledgeBaseService } from './knowledge-base.service.js'
import { KnowledgeBaseController } from './knowledge-base.controller.js'
import { FolderController } from './folder.controller.js'

@Module({
  providers: [KnowledgeBaseService],
  controllers: [KnowledgeBaseController, FolderController],
})
export class KnowledgeBaseModule {}
