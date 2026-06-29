import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { UserPasswordChangedEvent } from '../../modules/user/events/user-password-changed.event.js'
import { AuthRedisService } from '../auth-redis.service.js'

@Injectable()
export class UserPasswordChangedListener {
  private readonly logger = new Logger(UserPasswordChangedListener.name)

  constructor(private readonly authRedis: AuthRedisService) {}

  @OnEvent(UserPasswordChangedEvent.eventType)
  async handle(event: UserPasswordChangedEvent) {
    try {
      this.logger.log(`Password changed for user ${event.userId}, invalidating caches`)
      await this.authRedis.invalidateUserCache(event.userId)
    } catch (err) {
      this.logger.error(
        `Failed to invalidate cache for user ${event.userId}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
