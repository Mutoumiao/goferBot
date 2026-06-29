import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { KnowledgeBaseDeletedEvent } from '../events/kb-deleted.event.js'
import { KbCleanupService } from '../kb-cleanup.service.js'

@Injectable()
export class KnowledgeBaseDeletedListener {
  private readonly logger = new Logger(KnowledgeBaseDeletedListener.name)

  constructor(private readonly cleanupService: KbCleanupService) {}

  @OnEvent(KnowledgeBaseDeletedEvent.eventType)
  async handle(event: KnowledgeBaseDeletedEvent) {
    try {
      this.logger.log(`Cleaning up resources for deleted knowledge base ${event.knowledgeBaseId}`)
      await this.cleanupService.cleanupKnowledgeBase(event.knowledgeBaseId)
    } catch (err) {
      this.logger.error(
        `Failed to cleanup knowledge base ${event.knowledgeBaseId}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
