import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { Permission, RolePermission } from '@prisma/client'
import type { AuthApp } from '../types/auth-app.type.js'

@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPermissionsByRoleCode(roleCode: string, app: AuthApp): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      where: {
        rolePermissions: {
          some: { roleCode, app },
        },
        status: 'active',
      },
    })
  }

  async getPermissionsByUserId(userId: string, app: AuthApp): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        roles: {
          where: { app },
          select: { role: true },
        },
      },
    })

    if (!user) {
      return []
    }

    const roleCodes = new Set<string>()
    roleCodes.add(user.role)
    user.roles.forEach((r) => roleCodes.add(r.role))

    const permissions = await this.prisma.permission.findMany({
      where: {
        rolePermissions: {
          some: {
            roleCode: { in: Array.from(roleCodes) },
            app,
          },
        },
        status: 'active',
      },
      select: { code: true },
    })

    return permissions.map((p) => p.code)
  }

  async getAllPermissions(app?: AuthApp): Promise<Permission[]> {
    const where: Record<string, unknown> = {
      status: 'active',
    }

    if (app) {
      where.rolePermissions = {
        some: { app },
      }
    }

    return this.prisma.permission.findMany({
      where: where as any,
      orderBy: { sortOrder: 'asc' },
    })
  }

  async getPermissionByCode(code: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({
      where: { code },
    })
  }

  async createPermission(data: {
    code: string
    name: string
    description?: string
    type?: string
    resource?: string
    parentCode?: string
    sortOrder?: number
    status?: string
  }): Promise<Permission> {
    return this.prisma.permission.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        type: data.type ?? 'menu',
        resource: data.resource,
        parentCode: data.parentCode,
        sortOrder: data.sortOrder ?? 0,
        status: data.status ?? 'active',
      },
    })
  }

  async createRolePermission(data: {
    roleCode: string
    permissionId: string
    app: AuthApp
  }): Promise<RolePermission> {
    return this.prisma.rolePermission.create({
      data: {
        roleCode: data.roleCode,
        permissionId: data.permissionId,
        app: data.app,
      },
    })
  }

  async batchCreateRolePermissions(
    roleCode: string,
    permissionIds: string[],
    app: AuthApp,
  ): Promise<void> {
    await Promise.all(
      permissionIds.map((permissionId) =>
        this.prisma.rolePermission.upsert({
          where: {
            roleCode_permissionId_app: {
              roleCode,
              permissionId,
              app,
            },
          },
          update: {},
          create: {
            roleCode,
            permissionId,
            app,
          },
        }),
      ),
    )
  }
}
