import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { RequirePermission } from '../../auth/decorators/permission.decorator.js'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { AdminService } from './admin.service.js'
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto.js'
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js'

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @RequirePermission('users:read')
  async listUsers(@Query() query: AdminUserListQueryDto) {
    const result = await this.adminService.listUsers(query)
    return result
  }

  @Patch('users/:id/status')
  @RequirePermission('users:update')
  async updateUserStatus(@Param('id') userId: string, @Body() dto: UpdateUserStatusDto) {
    const result = await this.adminService.updateUserStatus(userId, dto)
    return result
  }
}
