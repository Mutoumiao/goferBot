import { Module } from '@nestjs/common'
import { SessionService } from './session.service.js'
import { SessionController } from './session.controller.js'

@Module({
  providers: [SessionService],
  controllers: [SessionController],
})
export class SessionModule {}
