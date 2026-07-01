import { Module } from '@nestjs/common'
import { AuthModule } from '../../auth/auth.module.js'
import { AuthRepositoryModule } from '../../auth/auth-repository.module.js'
import { AdminController } from './admin.controller.js'
import { AdminService } from './admin.service.js'
import { RoleController } from './role.controller.js'
import { RoleRepository } from './role.repository.js'
import { RoleService } from './role.service.js'

@Module({
  imports: [AuthModule, AuthRepositoryModule],
  controllers: [AdminController, RoleController],
  providers: [AdminService, RoleRepository, RoleService],
})
export class AdminModule {}
