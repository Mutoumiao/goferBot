import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { RequirePermission } from '../../auth/decorators/permission.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { ObservabilityDetailQueryDto } from './dto/dashboard-query.dto.js'
import { DashboardObservabilityService } from './services/dashboard-observability.service.js'

/**
 * 二级观测详页 API — system:metrics
 * GET /admin/observability/rag
 * GET /admin/observability/companion
 */
@Controller('admin/observability')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ObservabilityController {
  constructor(private readonly observability: DashboardObservabilityService) {}

  @Get('rag')
  @RequirePermission('system:metrics')
  async rag(@Query() query: ObservabilityDetailQueryDto) {
    return this.observability.getRagDetail(query.window ?? '24h')
  }

  @Get('companion')
  @RequirePermission('system:metrics')
  async companion(@Query() query: ObservabilityDetailQueryDto) {
    return this.observability.getCompanionDetail(query.window ?? '24h')
  }
}
