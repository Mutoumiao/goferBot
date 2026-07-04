import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'

export interface RoleWithPermissions {
  code: string
  name: string
  description: string | null
  app: string
  isSystem: boolean
  sortOrder: number
  status: string
  permissions: string[]
  userCount: number
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(app?: string): Promise<RoleWithPermissions[]> {
    const roles = await this.prisma.role.findMany({
      where: app ? { app } : undefined,
      orderBy: [{ app: 'asc' }, { sortOrder: 'asc' }],
      include: {
        rolePermissions: {
          where: { permission: { status: 'active' } },
          include: { permission: { select: { code: true } } },
        },
        _count: { select: { userRoles: true } },
      },
    })

    return roles.map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      app: r.app,
      isSystem: r.isSystem,
      sortOrder: r.sortOrder,
      status: r.status,
      permissions: r.rolePermissions.map((rp) => rp.permission.code),
      userCount: r._count.userRoles,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }

  async findByCode(code: string) {
    return this.prisma.role.findUnique({
      where: { code },
      include: {
        rolePermissions: {
          include: { permission: { select: { code: true, id: true } } },
        },
      },
    })
  }

  async create(data: {
    code: string
    name: string
    description?: string
    app: string
    sortOrder?: number
  }) {
    return this.prisma.role.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        app: data.app,
        isSystem: false,
        sortOrder: data.sortOrder ?? 100,
        status: 'active',
      },
    })
  }

  async update(
    code: string,
    data: { name?: string; description?: string; sortOrder?: number; status?: string },
  ) {
    return this.prisma.role.update({
      where: { code },
      data,
    })
  }

  async delete(code: string) {
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleCode: code } }),
      this.prisma.userRole.deleteMany({ where: { roleCode: code } }),
      this.prisma.role.delete({ where: { code } }),
    ])
  }

  async updateRolePermissions(roleCode: string, permissionIds: string[]) {
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleCode } }),
      ...permissionIds.map((permissionId) =>
        this.prisma.rolePermission.create({
          data: { roleCode, permissionId, app: 'admin' },
        }),
      ),
    ])
    return this.findByCode(roleCode)
  }

  async assignRole(userId: string, roleCode: string, app: string) {
    await this.prisma.userRole.upsert({
      where: { userId_app_roleCode: { userId, app, roleCode } },
      update: {},
      create: { userId, app, roleCode },
    })
  }

  async removeRole(userId: string, roleCode: string, app: string) {
    await this.prisma.userRole.deleteMany({
      where: { userId, app, roleCode },
    })
  }
}
