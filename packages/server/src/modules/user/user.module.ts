import { forwardRef, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { AuthModule } from '../../auth/auth.module.js'
import { SuperAdminBootstrapService } from './services/super-admin-bootstrap.service.js'
import { UserController } from './user.controller.js'
import { UserService } from './user.service.js'

@Module({
  imports: [ConfigModule, EventEmitterModule, forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [UserService, SuperAdminBootstrapService],
  exports: [UserService, SuperAdminBootstrapService],
})
export class UserModule {}
