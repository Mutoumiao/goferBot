import { forwardRef, Module } from '@nestjs/common'
import { AuthModule } from '../../auth/auth.module.js'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { KnowledgeAiModule } from '../../processors/knowledge-ai/knowledge-ai.module.js'
import { HealthModule } from '../health/health.module.js'
import { UserModule } from '../user/user.module.js'
import { AdminController } from './admin.controller.js'
import { AdminService } from './admin.service.js'
import { AuditController } from './audit.controller.js'
import { DashboardController } from './dashboard.controller.js'
import { InvitationController } from './invitation.controller.js'
import { ObservabilityController } from './observability.controller.js'
import { InvitationRepository } from './repositories/invitation.repository.js'
import { PermissionRepository } from './repositories/permission.repository.js'
import { RoleController } from './role.controller.js'
import { RoleRepository } from './role.repository.js'
import { RoleService } from './role.service.js'
import { PermissionSeeder } from './seeders/permission.seeder.js'
import { AuditService } from './services/audit.service.js'
import { DashboardObservabilityService } from './services/dashboard-observability.service.js'
import { InvitationService } from './services/invitation.service.js'
import { PermissionService } from './services/permission.service.js'

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => UserModule),
    HealthModule,
    KnowledgeAiModule,
  ],
  controllers: [
    AdminController,
    RoleController,
    InvitationController,
    AuditController,
    DashboardController,
    ObservabilityController,
  ],
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
    DashboardObservabilityService,
    PermissionGuard,
  ],
  exports: [PermissionRepository, PermissionService, AuditService, PermissionGuard],
})
export class AdminModule {}
