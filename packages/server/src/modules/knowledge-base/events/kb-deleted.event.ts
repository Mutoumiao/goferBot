import { DomainEvent } from '../../../common/events/domain-event.base.js'

export class KnowledgeBaseDeletedEvent extends DomainEvent {
  static readonly eventType = 'knowledge_base.deleted'
  readonly eventType = KnowledgeBaseDeletedEvent.eventType

  constructor(
    readonly knowledgeBaseId: string,
    readonly userId: string,
  ) {
    super()
  }
}
