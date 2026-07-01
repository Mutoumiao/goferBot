import { Injectable, NotFoundException } from '@nestjs/common'
import { PermissionRepository } from '../../auth/repositories/permission.repository.js'
import { PermissionService } from '../../auth/services/permission.service.js'
import { type Role, RoleRepository } from './role.repository.js'

export interface Permission {
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
    private readonly permissionService: PermissionService,
  ) {}

  async listRoles(): Promise<Role[]> {
    return this.roleRepository.findAll()
  }

  async getRole(roleCode: string): Promise<Role> {
    const role = await this.roleRepository.findById(roleCode)
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: '角色不存在',
      })
    }
    return role
  }

  async updateRole(
    roleCode: string,
    data: { name?: string; description?: string; permissions?: string[] },
  ): Promise<Role> {
    const role = await this.roleRepository.findById(roleCode)
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: '角色不存在',
      })
    }

    if (data.permissions !== undefined) {
      await this.roleRepository.updateRolePermissions(roleCode, data.permissions)
      await this.permissionService.invalidateAllPermissions()
    }

    return this.roleRepository.findById(roleCode) as Promise<Role>
  }

  async listPermissions(): Promise<Permission[]> {
    const permissions = await this.permissionRepository.getAllPermissions('admin')
    const groups: Record<string, Permission[]> = {}

    for (const p of permissions) {
      const group = p.parentCode || '其他'
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

    const result: Permission[] = []
    for (const [group, items] of Object.entries(groups)) {
      const groupName = this.getGroupName(group)
      result.push(...items.map((item) => ({ ...item, group: groupName })))
    }

    return result
  }

  private getGroupName(group: string): string {
    const map: Record<string, string> = {
      dashboard: '仪表盘',
      users: '用户管理',
      roles: '角色管理',
      rag: 'RAG 观测',
      sessions: '会话观测',
      audit: '审计日志',
      profile: '个人中心',
      modelProviders: '模型提供商',
      moduleSettings: '模块配置',
      other: '其他',
    }
    return map[group] || group
  }
}
