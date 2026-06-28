import { Module } from '@nestjs/common'
import { QueueModule } from '../../processors/queue/queue.module.js'
import { RagModule } from '../../processors/rag/rag.module.js'
import { StorageModule } from '../../processors/storage/storage.module.js'
import { DocumentController } from './document.controller.js'
import { DocumentService } from './document.service.js'
import { DocumentRepository } from './repositories/document.repository.js'
import { FolderController } from './folder.controller.js'
import { FolderService } from './folder.service.js'
import { FolderRepository } from './repositories/folder.repository.js'
import { KbCleanupService } from './kb-cleanup.service.js'
import { KnowledgeBaseController } from './knowledge-base.controller.js'
import { KnowledgeBaseService } from './knowledge-base.service.js'
import { KbRepository } from './repositories/kb.repository.js'

@Module({
  imports: [StorageModule, QueueModule, RagModule],
  providers: [
    KnowledgeBaseService,
    KbRepository,
    FolderService,
    FolderRepository,
    KbCleanupService,
    DocumentService,
    DocumentRepository,
  ],
  controllers: [KnowledgeBaseController, FolderController, DocumentController],
})
export class KnowledgeBaseModule {}
