import { Module } from '@nestjs/common'
import { KnowledgeBaseService } from './knowledge-base.service.js'
import { KnowledgeBaseController } from './knowledge-base.controller.js'
import { FolderController } from './folder.controller.js'
import { DocumentController } from './document.controller.js'
import { DocumentService } from './document.service.js'
import { StorageModule } from '../../processors/storage/storage.module.js'

@Module({
  imports: [StorageModule],
  providers: [KnowledgeBaseService, DocumentService],
  controllers: [KnowledgeBaseController, FolderController, DocumentController],
})
export class KnowledgeBaseModule {}
