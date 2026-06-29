import { Injectable, Logger, Optional } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { DocumentUploadedEvent } from '../../../modules/knowledge-base/events/document-uploaded.event.js'
import { QueueService } from '../../queue/queue.service.js'

@Injectable()
export class DocumentUploadedListener {
  private readonly logger = new Logger(DocumentUploadedListener.name)

  constructor(@Optional() private readonly queueService?: QueueService) {}

  @OnEvent(DocumentUploadedEvent.eventType)
  async handle(event: DocumentUploadedEvent) {
    try {
      this.logger.log(`Indexing document ${event.documentId} (kb=${event.kbId}) after upload`)
      const queueHealthy = await this.queueService?.isHealthy()
      if (queueHealthy) {
        await this.queueService?.addDocumentJob(event.documentId, 'index')
      }
    } catch (err) {
      this.logger.error(
        `Failed to enqueue index job for document ${event.documentId}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
