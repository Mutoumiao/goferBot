import { Module } from '@nestjs/common'
import { KnowledgeBaseService } from './knowledge-base.service.js'
import { KnowledgeBaseController } from './knowledge-base.controller.js'
import { FolderController } from './folder.controller.js'
import { DocumentController } from './document.controller.js'
import { DocumentService } from './document.service.js'
import { FolderService } from './folder.service.js'
import { KbCleanupService } from './kb-cleanup.service.js'
import { StorageModule } from '../../processors/storage/storage.module.js'
import { VectorModule } from '../../processors/vector/vector.module.js'
import { QueueModule } from '../../processors/queue/queue.module.js'

@Module({
  imports: [StorageModule, VectorModule, QueueModule],
  providers: [KnowledgeBaseService, FolderService, KbCleanupService, DocumentService],
  controllers: [KnowledgeBaseController, FolderController, DocumentController],
})
export class KnowledgeBaseModule {}
