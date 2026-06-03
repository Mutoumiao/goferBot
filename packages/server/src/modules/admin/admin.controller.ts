import { Controller, Get, Patch, Param, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { RolesGuard } from '../../auth/guards/roles.guard.js'
import { Roles } from '../../auth/decorators/roles.decorator.js'
import { BypassResponse } from '../../common/decorators/bypass-response.decorator.js'
import { Role } from '../../auth/enums/role.enum.js'
import { AdminService } from './admin.service.js'
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto.js'
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js'

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @BypassResponse()
  async listUsers(@Query() query: AdminUserListQueryDto) {
    const result = await this.adminService.listUsers(query)
    return result
  }

  @Patch('users/:id/status')
  @BypassResponse()
  async updateUserStatus(@Param('id') userId: string, @Body() dto: UpdateUserStatusDto) {
    const result = await this.adminService.updateUserStatus(userId, dto)
    return { data: result }
  }
}
