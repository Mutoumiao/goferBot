import { DomainEvent } from '../../../common/events/domain-event.base.js'

export class DocumentUploadedEvent extends DomainEvent {
  static readonly eventType = 'document.uploaded'
  readonly eventType = DocumentUploadedEvent.eventType

  constructor(
    readonly documentId: string,
    readonly kbId: string,
    readonly userId: string,
  ) {
    super()
  }
}
