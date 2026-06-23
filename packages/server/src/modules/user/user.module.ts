import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from '../../processors/database/database.module.js'
import { UserService } from './user.service.js'

@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
