import { Module } from '@nestjs/common'
import { QueueModule } from '../../processors/queue/queue.module.js'
import { RagModule } from '../../processors/rag/rag.module.js'
import { StorageModule } from '../../processors/storage/storage.module.js'
import { DocumentController } from './document.controller.js'
import { DocumentService } from './document.service.js'
import { DocumentMoveService } from './document-move.service.js'
import { DocumentPreviewService } from './document-preview.service.js'
import { DocumentUploadService } from './document-upload.service.js'
import { FolderController } from './folder.controller.js'
import { FolderService } from './folder.service.js'
import { FolderMoveService } from './folder-move.service.js'
import { FolderTreeService } from './folder-tree.service.js'
import { KbCleanupService } from './kb-cleanup.service.js'
import { KnowledgeBaseController } from './knowledge-base.controller.js'
import { KnowledgeBaseService } from './knowledge-base.service.js'
import { KnowledgeBaseDeletedListener } from './listeners/kb-deleted.listener.js'
import { DocumentRepository } from './repositories/document.repository.js'
import { FolderRepository } from './repositories/folder.repository.js'
import { KbRepository } from './repositories/kb.repository.js'

@Module({
  imports: [StorageModule, QueueModule, RagModule],
  providers: [
    KnowledgeBaseService,
    KbRepository,
    FolderService,
    FolderTreeService,
    FolderMoveService,
    FolderRepository,
    KbCleanupService,
    DocumentService,
    DocumentUploadService,
    DocumentMoveService,
    DocumentPreviewService,
    DocumentRepository,
    KnowledgeBaseDeletedListener,
  ],
  controllers: [KnowledgeBaseController, FolderController, DocumentController],
})
export class KnowledgeBaseModule {}
