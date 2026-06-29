import { DomainEvent } from '../../../common/events/domain-event.base.js'

export class UserPasswordChangedEvent extends DomainEvent {
  static readonly eventType = 'user.password.changed'
  readonly eventType = UserPasswordChangedEvent.eventType

  constructor(readonly userId: string) {
    super()
  }
}
