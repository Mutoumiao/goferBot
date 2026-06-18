import { Module } from '@nestjs/common'
import { MessageRepository } from './repositories/message.repository.js'
import { SessionRepository } from './repositories/session.repository.js'
import { SessionController } from './session.controller.js'
import { SessionService } from './session.service.js'

@Module({
  providers: [SessionService, SessionRepository, MessageRepository],
  controllers: [SessionController],
  exports: [SessionService, SessionRepository, MessageRepository],
})
export class SessionModule {}
