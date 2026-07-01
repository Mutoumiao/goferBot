import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { RequirePermission } from '../../auth/decorators/permission.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { PermissionService } from '../../auth/services/permission.service.js'
import { RoleService } from './role.service.js'

@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly permissionService: PermissionService,
  ) {}

  @Get()
  @RequirePermission('roles:read')
  async list() {
    return this.roleService.listRoles()
  }

  @Get(':id')
  @RequirePermission('roles:read')
  async get(@Param('id') id: string) {
    return this.roleService.getRole(id)
  }

  @Patch(':id')
  @RequirePermission('roles:update')
  async update(
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string; permissions?: string[] },
  ) {
    return this.roleService.updateRole(id, data)
  }

  @Get('permissions')
  @RequirePermission('roles:read')
  async getAllPermissions() {
    return this.roleService.listPermissions()
  }

  @Get(':roleCode/permissions')
  @RequirePermission('roles:read')
  async getRolePermissions(@Param('roleCode') roleCode: string) {
    const role = await this.roleService.getRole(roleCode)
    return role.permissions
  }

  @Post(':roleCode/permissions')
  @RequirePermission('roles:update')
  async assignPermissionsToRole(
    @Param('roleCode') roleCode: string,
    @Body() dto: { permissionCodes: string[] },
  ) {
    await this.roleService.updateRole(roleCode, { permissions: dto.permissionCodes })
    return { success: true }
  }

  @Get('user/:userId')
  @RequirePermission('users:read')
  async getUserPermissions(@Param('userId') userId: string) {
    return this.permissionService.getUserPermissions(userId, 'admin')
  }
}
