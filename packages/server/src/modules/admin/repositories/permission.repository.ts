import { Injectable } from '@nestjs/common'
import type { Permission, RolePermission } from '@prisma/client'
import type { AuthApp } from '../../../auth/types/auth-app.type.js'
import { PrismaService } from '../../../processors/database/prisma.service.js'

@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserRoles(userId: string, app: AuthApp): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, app },
      select: { roleCode: true },
    })
    return userRoles.map((r) => r.roleCode)
  }

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
    const roleCodes = await this.getUserRoles(userId, app)

    if (roleCodes.length === 0) {
      return []
    }

    if (roleCodes.includes('super_admin') && app === 'admin') {
      return ['*']
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        rolePermissions: {
          some: {
            roleCode: { in: roleCodes },
          },
        },
        status: 'active',
      },
      select: { code: true },
    })

    return [...new Set(permissions.map((p) => p.code))]
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

  async findByCodes(codes: string[]): Promise<Permission[]> {
    if (codes.length === 0) return []
    return this.prisma.permission.findMany({
      where: { code: { in: codes }, status: 'active' },
    })
  }

  async upsertPermission(data: {
    code: string
    name: string
    description?: string
    type?: string
    parentCode?: string
    sortOrder?: number
  }): Promise<Permission> {
    return this.prisma.permission.upsert({
      where: { code: data.code },
      update: {
        name: data.name,
        description: data.description,
        type: data.type ?? 'menu',
        parentCode: data.parentCode,
        sortOrder: data.sortOrder ?? 0,
      },
      create: {
        code: data.code,
        name: data.name,
        description: data.description,
        type: data.type ?? 'menu',
        parentCode: data.parentCode,
        sortOrder: data.sortOrder ?? 0,
        status: 'active',
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
    if (permissionIds.length === 0) {
      await this.prisma.rolePermission.deleteMany({
        where: { roleCode, app },
      })
      return
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({
        where: { roleCode, app },
      }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleCode,
          permissionId,
          app,
        })),
        skipDuplicates: true,
      }),
    ])
  }
}
