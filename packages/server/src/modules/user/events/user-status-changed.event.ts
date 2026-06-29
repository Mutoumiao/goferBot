import { DomainEvent } from '../../../common/events/domain-event.base.js'

export class UserStatusChangedEvent extends DomainEvent {
  static readonly eventType = 'user.status.changed'
  readonly eventType = UserStatusChangedEvent.eventType

  constructor(
    readonly userId: string,
    readonly isActive: boolean,
    readonly previousStatus: boolean,
  ) {
    super()
  }
}
