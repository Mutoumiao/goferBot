import { Module } from '@nestjs/common'
import { SessionService } from './session.service.js'
import { SessionController } from './session.controller.js'
import { SessionRepository } from './repositories/session.repository.js'
import { MessageRepository } from './repositories/message.repository.js'

@Module({
  providers: [SessionService, SessionRepository, MessageRepository],
  controllers: [SessionController],
  exports: [SessionService, SessionRepository, MessageRepository],
})
export class SessionModule {}
