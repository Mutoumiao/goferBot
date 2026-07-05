import { Module } from '@nestjs/common'
import { AuthRepositoryModule } from '../../auth/auth-repository.module.js'
import { PermissionRepository } from '../admin/repositories/permission.repository.js'
import { PermissionService } from '../admin/services/permission.service.js'

@Module({
  imports: [AuthRepositoryModule],
  providers: [PermissionRepository, PermissionService],
  exports: [PermissionRepository, PermissionService],
})
export class PermissionModule {}
