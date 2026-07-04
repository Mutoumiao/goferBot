import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { RequirePermission } from '../../auth/decorators/permission.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { AuditService } from './services/audit.service.js'

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission('audit:read')
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('operation') operation?: string,
    @Query('actor') actor?: string,
  ) {
    return this.auditService.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      operation,
      actor,
    })
  }
}
