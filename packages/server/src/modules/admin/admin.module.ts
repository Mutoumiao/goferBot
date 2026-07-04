import { forwardRef, Module } from '@nestjs/common'
import { AuthModule } from '../../auth/auth.module.js'
import { UserModule } from '../user/user.module.js'
import { AdminController } from './admin.controller.js'
import { AdminService } from './admin.service.js'
import { AuditController } from './audit.controller.js'
import { InvitationController } from './invitation.controller.js'
import { InvitationRepository } from './repositories/invitation.repository.js'
import { PermissionRepository } from './repositories/permission.repository.js'
import { RoleController } from './role.controller.js'
import { RoleRepository } from './role.repository.js'
import { RoleService } from './role.service.js'
import { PermissionSeeder } from './seeders/permission.seeder.js'
import { AuditService } from './services/audit.service.js'
import { InvitationService } from './services/invitation.service.js'
import { PermissionService } from './services/permission.service.js'

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => UserModule)],
  controllers: [AdminController, RoleController, InvitationController, AuditController],
  providers: [
    AdminService,
    RoleRepository,
    RoleService,
    PermissionRepository,
    PermissionService,
    PermissionSeeder,
    InvitationRepository,
    InvitationService,
    AuditService,
  ],
  exports: [PermissionRepository, PermissionService, AuditService],
})
export class AdminModule {}
