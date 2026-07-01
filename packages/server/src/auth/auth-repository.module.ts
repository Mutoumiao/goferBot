import { Module } from '@nestjs/common'
import { AuthRepository } from './repositories/auth.repository.js'
import { PermissionRepository } from './repositories/permission.repository.js'

@Module({
  providers: [AuthRepository, PermissionRepository],
  exports: [AuthRepository, PermissionRepository],
})
export class AuthRepositoryModule {}
