import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthApp } from '../../auth/types/auth-app.type.js'
import { PermissionRepository } from './repositories/permission.repository.js'
import { RoleRepository, type RoleWithPermissions } from './role.repository.js'
import { PermissionService } from './services/permission.service.js'

export interface PermissionGroup {
  key: string
  name: string
  description?: string
  group: string
}

@Injectable()
export class RoleService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
    @Inject(forwardRef(() => PermissionService))
    private readonly permissionService: PermissionService,
  ) {}

  async listRoles(app?: AuthApp): Promise<RoleWithPermissions[]> {
    return this.roleRepository.findAll(app)
  }

  async getRole(roleCode: string): Promise<RoleWithPermissions> {
    const role = await this.roleRepository.findByCode(roleCode)
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: '角色不存在',
      })
    }
    return {
      code: role.code,
      name: role.name,
      description: role.description,
      app: role.app,
      isSystem: role.isSystem,
      sortOrder: role.sortOrder,
      status: role.status,
      permissions: role.rolePermissions.map((rp) => rp.permission.code),
      userCount: 0,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }
  }

  async createRole(data: { code: string; name: string; description?: string; app: AuthApp }) {
    const role = await this.roleRepository.create(data)
    return this.getRole(role.code)
  }

  async updateRole(
    roleCode: string,
    data: { name?: string; description?: string; sortOrder?: number; permissions?: string[] },
  ): Promise<RoleWithPermissions> {
    const role = await this.roleRepository.findByCode(roleCode)
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: '角色不存在',
      })
    }

    if (data.name !== undefined || data.description !== undefined || data.sortOrder !== undefined) {
      await this.roleRepository.update(roleCode, {
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder,
      })
    }

    if (data.permissions !== undefined) {
      const permRecords = await this.permissionRepository.findByCodes(data.permissions)
      const permissionIds = permRecords.map((p: { id: string }) => p.id)
      await this.roleRepository.updateRolePermissions(roleCode, permissionIds)
      await this.permissionService.invalidateAllPermissions()
    }

    return this.getRole(roleCode)
  }

  async deleteRole(roleCode: string): Promise<void> {
    const role = await this.roleRepository.findByCode(roleCode)
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: '角色不存在',
      })
    }
    if (role.isSystem) {
      throw new NotFoundException({
        code: 'SYSTEM_ROLE_DELETE_DENIED',
        message: '系统角色不可删除',
      })
    }
    await this.roleRepository.delete(roleCode)
    await this.permissionService.invalidateAllPermissions()
  }

  async listPermissions(app?: AuthApp): Promise<PermissionGroup[]> {
    const permissions = await this.permissionRepository.getAllPermissions(app ?? 'admin')
    const groups: Record<string, PermissionGroup[]> = {}

    for (const p of permissions) {
      const group = p.parentCode || 'other'
      if (!groups[group]) {
        groups[group] = []
      }
      groups[group].push({
        key: p.code,
        name: p.name,
        description: p.description || undefined,
        group,
      })
    }

    const result: PermissionGroup[] = []
    for (const [group, items] of Object.entries(groups)) {
      const groupName = this.getGroupName(group)
      result.push(...items.map((item) => ({ ...item, group: groupName })))
    }

    return result
  }

  async assignRoleToUser(userId: string, roleCode: string, app: AuthApp): Promise<void> {
    await this.roleRepository.assignRole(userId, roleCode, app)
    await this.permissionService.invalidateUserPermissions(userId, app)
  }

  async removeRoleFromUser(userId: string, roleCode: string, app: AuthApp): Promise<void> {
    await this.roleRepository.removeRole(userId, roleCode, app)
    await this.permissionService.invalidateUserPermissions(userId, app)
  }

  private getGroupName(group: string): string {
    const map: Record<string, string> = {
      dashboard: '仪表盘',
      users: '用户管理',
      roles: '角色管理',
      invitations: '邀请码管理',
      audit: '审计日志',
      settings: '系统配置',
      system: '系统运维',
      profile: '个人中心',
      other: '其他',
    }
    return map[group] || group
  }
}
