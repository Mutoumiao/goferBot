import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'

export interface Role {
  id: string
  name: string
  description?: string
  isBuiltIn?: boolean
  permissions: string[]
  createdAt: string
  updatedAt: string
}

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Role[]> {
    const roles = await this.prisma.userRole.groupBy({
      by: ['role'],
      _count: true,
    })

    const roleNames = new Set(['SUPER_ADMIN', 'ADMIN', 'USER', ...roles.map((r) => r.role)])

    return Promise.all(
      Array.from(roleNames).map(async (role) => {
        const permissions = await this.prisma.permission.findMany({
          where: {
            rolePermissions: {
              some: { roleCode: role, app: 'admin' },
            },
            status: 'active',
          },
          select: { code: true },
        })

        return {
          id: role,
          name: this.getRoleDisplayName(role),
          description: this.getRoleDescription(role),
          isBuiltIn: ['SUPER_ADMIN', 'ADMIN', 'USER'].includes(role),
          permissions: permissions.map((p) => p.code),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }

  async findById(roleCode: string): Promise<Role | null> {
    const permissions = await this.prisma.permission.findMany({
      where: {
        rolePermissions: {
          some: { roleCode, app: 'admin' },
        },
        status: 'active',
      },
      select: { code: true },
    })

    if (permissions.length === 0) {
      return null
    }

    return {
      id: roleCode,
      name: this.getRoleDisplayName(roleCode),
      description: this.getRoleDescription(roleCode),
      isBuiltIn: ['SUPER_ADMIN', 'ADMIN', 'USER'].includes(roleCode),
      permissions: permissions.map((p) => p.code),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  async updateRolePermissions(roleCode: string, permissionCodes: string[]): Promise<Role | null> {
    const existingPermissions = await this.prisma.permission.findMany({
      where: { status: 'active' },
      select: { id: true, code: true },
    })

    const permissionIds = existingPermissions
      .filter((p) => permissionCodes.includes(p.code))
      .map((p) => p.id)

    await this.prisma.rolePermission.deleteMany({
      where: { roleCode, app: 'admin' },
    })

    await Promise.all(
      permissionIds.map((permissionId) =>
        this.prisma.rolePermission.create({
          data: { roleCode, permissionId, app: 'admin' },
        }),
      ),
    )

    return this.findById(roleCode)
  }

  private getRoleDisplayName(role: string): string {
    const map: Record<string, string> = {
      SUPER_ADMIN: '超级管理员',
      ADMIN: '管理员',
      USER: '普通用户',
    }
    return map[role] || role
  }

  private getRoleDescription(role: string): string {
    const map: Record<string, string> = {
      SUPER_ADMIN: '拥有系统所有权限',
      ADMIN: '拥有大部分管理权限',
      USER: '基础用户权限',
    }
    return map[role] || ''
  }
}
