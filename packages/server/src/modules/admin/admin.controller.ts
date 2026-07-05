import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { RequirePermission } from '../../auth/decorators/permission.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { AdminService } from './admin.service.js'
import { AssignRoleDto, CreateAdminUserDto, ResetPasswordDto } from './dto/admin-user.dto.js'
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto.js'
import { UpdateAdminUserDto } from './dto/update-admin-user.dto.js'
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js'
import { AuditService } from './services/audit.service.js'

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  @Get('users')
  @RequirePermission('users:read')
  async listUsers(@Query() query: AdminUserListQueryDto) {
    return this.adminService.listUsers(query)
  }

  @Get('users/:id')
  @RequirePermission('users:read')
  async getUser(@Param('id') userId: string) {
    return this.adminService.getUser(userId)
  }

  @Post('users')
  @RequirePermission('users:create')
  async createUser(@Body() dto: CreateAdminUserDto, @CurrentUser('id') actorId: string) {
    const user = await this.adminService.createUser(dto, actorId)
    await this.auditService.log({
      actor: actorId,
      operation: 'user.create',
      target: 'user',
      targetId: user.id,
      metadata: { email: dto.email, roles: dto.roles },
    })
    return user
  }

  @Patch('users/:id')
  @RequirePermission('users:update')
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id') userId: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser('id') actorId: string,
  ) {
    await this.adminService.updateUser(userId, dto)
    await this.auditService.log({
      actor: actorId,
      operation: 'user.update',
      target: 'user',
      targetId: userId,
    })
    return { success: true }
  }

  @Patch('users/:id/status')
  @RequirePermission('users:update')
  @HttpCode(HttpStatus.OK)
  async updateUserStatus(
    @Param('id') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('id') actorId: string,
  ) {
    const result = await this.adminService.updateUserStatus(userId, dto)
    await this.auditService.log({
      actor: actorId,
      operation: 'user.update_status',
      target: 'user',
      targetId: userId,
      metadata: { isActive: dto.isActive },
    })
    return result
  }

  @Post('users/:id/role')
  @RequirePermission('users:update')
  @HttpCode(HttpStatus.OK)
  async assignRole(
    @Param('id') userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser('id') actorId: string,
  ) {
    const result = await this.adminService.assignRoles(userId, dto.roles, actorId)
    await this.auditService.log({
      actor: actorId,
      operation: 'user.assign_role',
      target: 'user',
      targetId: userId,
      metadata: { roles: dto.roles },
    })
    return result
  }

  @Delete('users/:id')
  @RequirePermission('users:delete')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') userId: string, @CurrentUser('id') actorId: string) {
    const result = await this.adminService.deleteUser(userId)
    await this.auditService.log({
      actor: actorId,
      operation: 'user.delete',
      target: 'user',
      targetId: userId,
    })
    return result
  }

  @Post('users/:id/reset-password')
  @RequirePermission('users:update')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('id') userId: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser('id') actorId: string,
  ) {
    const result = await this.adminService.resetPassword(userId, dto.newPassword, actorId)
    await this.auditService.log({
      actor: actorId,
      operation: 'user.reset_password',
      target: 'user',
      targetId: userId,
    })
    return result
  }
}
