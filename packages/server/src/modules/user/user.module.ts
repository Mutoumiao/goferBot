import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../processors/database/database.module.js'
import { UserService } from './user.service.js'

@Module({
  imports: [DatabaseModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
