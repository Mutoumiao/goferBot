import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AuthRepository } from '../../auth/repositories/auth.repository.js'
import { UserStatusChangedEvent } from '../../modules/user/events/user-status-changed.event.js'

@Injectable()
export class UserStatusChangedListener {
  private readonly logger = new Logger(UserStatusChangedListener.name)

  constructor(private readonly authRepository: AuthRepository) {}

  @OnEvent(UserStatusChangedEvent.eventType)
  async handle(event: UserStatusChangedEvent) {
    if (event.previousStatus && !event.isActive) {
      try {
        this.logger.log(
          `Revoking all sessions for user ${event.userId} due to account deactivation`,
        )
        await this.authRepository.revokeAllSessionsForUser(event.userId, 'user_disabled')
      } catch (err) {
        this.logger.error(
          `Failed to revoke sessions for user ${event.userId}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
  }
}
