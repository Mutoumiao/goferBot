import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { Prisma } from '@prisma/client'
import { hash } from 'bcrypt'
import type { AuthApp } from '../../auth/types/auth-app.type.js'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { emailAlreadyExistsError, userNotFoundError } from '../user/errors.js'
import { UserStatusChangedEvent } from '../user/events/user-status-changed.event.js'
import { UserService } from '../user/user.service.js'
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto.js'
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js'
import { RoleService } from './role.service.js'
import { PermissionService } from './services/permission.service.js'

export interface AdminUserListItem {
  id: string
  email: string
  name: string | null
  avatar: string | null
  isActive: boolean
  roles: string[]
  createdAt: string
  updatedAt: string
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly permissionService: PermissionService,
  ) {}

  async listUsers(query: AdminUserListQueryDto) {
    const { page, pageSize, search, isActive, role } = query

    const where: Prisma.UserWhereInput = {}

    if (search) {
      where.email = { contains: search, mode: 'insensitive' }
    }

    if (isActive !== undefined) {
      where.isActive = isActive
    }

    if (role) {
      where.roles = {
        some: {
          app: 'admin',
          roleCode: role,
        },
      }
    }

    const take = pageSize ?? 10
    const skip = ((page ?? 1) - 1) * take

    const [total, users] = (await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      (this.prisma.user as any).findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          roles: {
            where: { app: 'admin' },
            select: { roleCode: true },
          },
        },
      }),
    ])) as [
      number,
      Array<{
        id: string
        email: string
        name: string | null
        avatar: string | null
        isActive: boolean
        createdAt: Date
        updatedAt: Date
        roles: Array<{ roleCode: string }>
      }>,
    ]

    const items: AdminUserListItem[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatar: u.avatar,
      isActive: u.isActive,
      roles: u.roles.map((ur) => ur.roleCode),
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }))

    return {
      items,
      total,
      page: page ?? 1,
      pageSize: take,
    }
  }

  async getUser(userId: string) {
    const user = await (this.prisma.user as any).findUnique({
      where: { id: userId },
      include: {
        roles: {
          where: { app: 'admin' },
          select: { roleCode: true },
        },
      },
    })

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '用户不存在' })
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      isActive: user.isActive,
      roles: user.roles.map((ur: { roleCode: string }) => ur.roleCode),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }
  }

  async createUser(
    dto: { email: string; name?: string; password: string; roles: string[] },
    actorId: string,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      throw emailAlreadyExistsError()
    }

    const isSuperAdmin = await this.permissionService.isSuperAdmin(actorId)
    const hasAdminRole = dto.roles.some((r) => r === 'admin' || r === 'super_admin')
    if (hasAdminRole && !isSuperAdmin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '只有超级管理员可以创建管理员用户',
      })
    }

    const user = await this.userService.create(dto.email, dto.password, dto.name)

    for (const roleCode of dto.roles) {
      await this.roleService.assignRoleToUser(user.id, roleCode, 'admin' as AuthApp)
    }

    if (dto.roles.includes('user')) {
      await this.roleService.assignRoleToUser(user.id, 'user', 'web' as AuthApp)
    }

    return this.getUser(user.id)
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    })

    if (!user) {
      throw userNotFoundError()
    }

    if (!dto.isActive && user.isActive) {
      const userHasSuperAdmin = await (this.prisma.userRole as any).findFirst({
        where: { userId, app: 'admin', roleCode: 'super_admin' },
      })
      if (userHasSuperAdmin) {
        const activeSuperAdmins = await (this.prisma.userRole as any).count({
          where: {
            roleCode: 'super_admin',
            app: 'admin',
            user: { isActive: true },
          },
        })
        if (activeSuperAdmins <= 1) {
          throw new ForbiddenException({
            code: 'SUPER_ADMIN_PROTECTED',
            message: '不能禁用最后一个超级管理员',
          })
        }
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
    })

    await this.eventEmitter.emitAsync(
      UserStatusChangedEvent.eventType,
      new UserStatusChangedEvent(userId, dto.isActive, user.isActive),
    )

    return { success: true }
  }

  async assignRoles(userId: string, roles: string[], _actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw userNotFoundError()
    }

    const isSuperAdmin = await (this.prisma.userRole as any).findFirst({
      where: { userId, app: 'admin', roleCode: 'super_admin' },
    })
    if (isSuperAdmin && !roles.includes('super_admin')) {
      throw new ForbiddenException({
        code: 'SUPER_ADMIN_PROTECTED',
        message: '不能移除超级管理员角色',
      })
    }

    await (this.prisma.userRole as any).deleteMany({ where: { userId, app: 'admin' } })
    for (const roleCode of roles) {
      await this.roleService.assignRoleToUser(userId, roleCode, 'admin' as AuthApp)
    }

    if (roles.some((r) => r === 'admin' || r === 'super_admin')) {
      await this.roleService.assignRoleToUser(userId, 'user', 'web' as AuthApp)
    }

    return { success: true }
  }

  async resetPassword(userId: string, newPassword: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw userNotFoundError()
    }

    const isSuperAdmin = await this.permissionService.isSuperAdmin(actorId)
    if (!isSuperAdmin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '只有超级管理员可以重置密码',
      })
    }

    const userRoles = await (this.prisma.userRole as any).findMany({
      where: { userId, app: 'admin', roleCode: { in: ['admin', 'super_admin'] } },
    })
    if (userRoles.length === 0) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '只能重置管理员用户的密码',
      })
    }

    if (newPassword.length < 8) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '密码至少8个字符' })
    }

    const hashedPassword = await hash(newPassword, 12)
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return { success: true }
  }

  async updateUser(userId: string, dto: { name?: string; roles?: string[]; isActive?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw userNotFoundError()
    }

    const data: Prisma.UserUpdateInput = {}
    if (dto.name !== undefined) {
      data.name = dto.name
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id: userId }, data })
    }

    if (dto.roles) {
      await this.assignRoles(userId, dto.roles, '')
    }

    return { success: true }
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw userNotFoundError()
    }

    const isSuperAdmin = await (this.prisma.userRole as any).findFirst({
      where: { userId, app: 'admin', roleCode: 'super_admin' },
    })
    if (isSuperAdmin) {
      throw new ForbiddenException({ code: 'SUPER_ADMIN_PROTECTED', message: '不能删除超级管理员' })
    }

    await this.prisma.user.delete({ where: { id: userId } })
    return { success: true }
  }
}
