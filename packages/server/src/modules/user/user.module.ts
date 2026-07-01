import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthRepositoryModule } from '../../auth/auth-repository.module.js'
import { DatabaseModule } from '../../processors/database/database.module.js'
import { SuperAdminBootstrapService } from './services/super-admin-bootstrap.service.js'
import { UserService } from './user.service.js'

@Module({
  imports: [DatabaseModule, ConfigModule, AuthRepositoryModule],
  providers: [UserService, SuperAdminBootstrapService],
  exports: [UserService, SuperAdminBootstrapService],
})
export class UserModule {}
