import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { RequirePermission } from '../../auth/decorators/permission.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { DashboardSummaryQueryDto } from './dto/dashboard-query.dto.js'
import { DashboardObservabilityService } from './services/dashboard-observability.service.js'

/**
 * 新建 Admin 观测 Hub 路由（非改造既有 /admin/dashboard 假契约）。
 * GET /admin/dashboard/summary — dashboard:read
 */
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly observability: DashboardObservabilityService) {}

  @Get('summary')
  @RequirePermission('dashboard:read')
  async summary(@Query() query: DashboardSummaryQueryDto) {
    return this.observability.getSummary(query.window ?? '24h')
  }
}
