import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../processors/database/prisma.service.js'

interface PermissionDef {
  code: string
  name: string
  description: string
  parentCode: string
  sortOrder: number
}

const SYSTEM_ROLES = [
  { code: 'super_admin', name: '超级管理员', app: 'admin', isSystem: true, sortOrder: 0 },
  { code: 'admin', name: '管理员', app: 'admin', isSystem: true, sortOrder: 10 },
  { code: 'user', name: '普通用户', app: 'web', isSystem: true, sortOrder: 0 },
] as const

const PERMISSIONS: PermissionDef[] = [
  {
    code: 'dashboard:read',
    name: '查看仪表盘',
    description: '查看系统仪表盘统计数据',
    parentCode: 'dashboard',
    sortOrder: 0,
  },

  {
    code: 'users:read',
    name: '查看用户',
    description: '查看用户列表和详情',
    parentCode: 'users',
    sortOrder: 0,
  },
  {
    code: 'users:create',
    name: '创建用户',
    description: '创建新用户',
    parentCode: 'users',
    sortOrder: 10,
  },
  {
    code: 'users:update',
    name: '更新用户',
    description: '启用/禁用用户',
    parentCode: 'users',
    sortOrder: 20,
  },
  {
    code: 'users:delete',
    name: '删除用户',
    description: '删除用户',
    parentCode: 'users',
    sortOrder: 30,
  },
  {
    code: 'users:reset-password',
    name: '重置密码',
    description: '重置管理员密码',
    parentCode: 'users',
    sortOrder: 40,
  },

  {
    code: 'roles:read',
    name: '查看角色',
    description: '查看角色列表和权限',
    parentCode: 'roles',
    sortOrder: 0,
  },
  {
    code: 'roles:create',
    name: '创建角色',
    description: '创建自定义角色',
    parentCode: 'roles',
    sortOrder: 10,
  },
  {
    code: 'roles:update',
    name: '更新角色',
    description: '更新角色信息和权限分配',
    parentCode: 'roles',
    sortOrder: 20,
  },
  {
    code: 'roles:delete',
    name: '删除角色',
    description: '删除自定义角色',
    parentCode: 'roles',
    sortOrder: 30,
  },

  {
    code: 'invitations:read',
    name: '查看邀请码',
    description: '查看邀请码列表',
    parentCode: 'invitations',
    sortOrder: 0,
  },
  {
    code: 'invitations:create',
    name: '生成邀请码',
    description: '生成新邀请码',
    parentCode: 'invitations',
    sortOrder: 10,
  },
  {
    code: 'invitations:update',
    name: '作废邀请码',
    description: '作废未使用的邀请码',
    parentCode: 'invitations',
    sortOrder: 20,
  },
  {
    code: 'invitations:delete',
    name: '删除邀请码',
    description: '删除未使用的邀请码',
    parentCode: 'invitations',
    sortOrder: 30,
  },

  {
    code: 'audit:read',
    name: '查看审计日志',
    description: '查看操作审计日志',
    parentCode: 'audit',
    sortOrder: 0,
  },
  {
    code: 'audit:export',
    name: '导出审计日志',
    description: '导出审计日志',
    parentCode: 'audit',
    sortOrder: 10,
  },

  {
    code: 'settings:read',
    name: '查看配置',
    description: '查看系统配置',
    parentCode: 'settings',
    sortOrder: 0,
  },
  {
    code: 'settings:update',
    name: '更新配置',
    description: '修改系统配置',
    parentCode: 'settings',
    sortOrder: 10,
  },

  {
    code: 'companions:read',
    name: '查看内置伴侣',
    description: '查看平台内置伴侣列表与详情',
    parentCode: 'companions',
    sortOrder: 0,
  },
  {
    code: 'companions:write',
    name: '管理内置伴侣',
    description: '创建、更新、发布与归档平台内置伴侣',
    parentCode: 'companions',
    sortOrder: 10,
  },

  {
    code: 'system:metrics',
    name: '系统监控',
    description: '查看系统指标和监控',
    parentCode: 'system',
    sortOrder: 0,
  },
  {
    code: 'system:maintenance',
    name: '系统维护',
    description: '执行系统维护操作',
    parentCode: 'system',
    sortOrder: 10,
  },
  {
    code: 'system:logs',
    name: '系统日志',
    description: '查看系统日志',
    parentCode: 'system',
    sortOrder: 20,
  },
]

@Injectable()
export class PermissionSeeder implements OnModuleInit {
  private readonly logger = new Logger(PermissionSeeder.name)

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.seed()
    } catch (error) {
      this.logger.error('Permission seeding failed', error)
    }
  }

  async seed(): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 确保系统用户存在（settings 模块的 SYSTEM_USER_ID 外键依赖）
      await tx.user.upsert({
        where: { id: '00000000-0000-0000-0000-000000000000' },
        update: {},
        create: {
          id: '00000000-0000-0000-0000-000000000000',
          email: 'system@goferbot.local',
          name: 'System',
          password: '$2b$12$placeholder.placeholder.placeholder.',
          isActive: false,
        },
      })

      for (const role of SYSTEM_ROLES) {
        await tx.role.upsert({
          where: { code: role.code },
          update: {
            name: role.name,
            app: role.app,
            isSystem: role.isSystem,
            sortOrder: role.sortOrder,
            status: 'active',
          },
          create: {
            code: role.code,
            name: role.name,
            app: role.app,
            isSystem: role.isSystem,
            sortOrder: role.sortOrder,
            status: 'active',
          },
        })
      }

      const permissionIds = new Map<string, string>()
      for (const perm of PERMISSIONS) {
        const created = await tx.permission.upsert({
          where: { code: perm.code },
          update: {
            name: perm.name,
            description: perm.description,
            parentCode: perm.parentCode,
            sortOrder: perm.sortOrder,
            type: 'menu',
            status: 'active',
          },
          create: {
            code: perm.code,
            name: perm.name,
            description: perm.description,
            parentCode: perm.parentCode,
            sortOrder: perm.sortOrder,
            type: 'menu',
            status: 'active',
          },
        })
        permissionIds.set(perm.code, created.id)
      }

      await tx.rolePermission.deleteMany({
        where: { roleCode: 'super_admin', app: 'admin' },
      })
      const superAdminPermIds = PERMISSIONS.map((p) => permissionIds.get(p.code)).filter(
        (id): id is string => !!id,
      )
      if (superAdminPermIds.length > 0) {
        await tx.rolePermission.createMany({
          data: superAdminPermIds.map((permId) => ({
            roleCode: 'super_admin',
            permissionId: permId,
            app: 'admin',
          })),
          skipDuplicates: true,
        })
      }

      await tx.rolePermission.deleteMany({
        where: { roleCode: 'admin', app: 'admin' },
      })
      const adminPermIds = PERMISSIONS.map((p) => permissionIds.get(p.code)).filter(
        (id): id is string => !!id,
      )
      if (adminPermIds.length > 0) {
        await tx.rolePermission.createMany({
          data: adminPermIds.map((permId) => ({
            roleCode: 'admin',
            permissionId: permId,
            app: 'admin',
          })),
          skipDuplicates: true,
        })
      }

      await tx.rolePermission.deleteMany({
        where: { roleCode: 'user', app: 'web' },
      })
    })

    this.logger.log(`Seeded ${SYSTEM_ROLES.length} roles and ${PERMISSIONS.length} permissions`)
  }
}
