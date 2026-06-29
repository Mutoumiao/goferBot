import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { Prisma } from '@prisma/client'
import { AuthRepository } from '../../auth/repositories/auth.repository.js'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { userNotFoundError } from '../user/errors.js'
import { UserStatusChangedEvent } from '../user/events/user-status-changed.event.js'
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto.js'
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js'

const USER_LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    readonly _authRepository: AuthRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listUsers(query: AdminUserListQueryDto) {
    const { page, pageSize, search, isActive } = query

    const where: Prisma.UserWhereInput = {}

    if (search) {
      where.email = { contains: search, mode: 'insensitive' }
    }

    if (isActive !== undefined) {
      where.isActive = isActive
    }

    const result = await this.prisma.user.paginate(
      {
        where,
        orderBy: { createdAt: 'desc' },
        select: USER_LIST_SELECT,
      },
      { page: page ?? 1, size: pageSize ?? 10 },
    )

    const items = result.data.filter((user): user is NonNullable<typeof user> => user !== null)

    return {
      items: items.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
      pagination: result.pagination,
    }
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    })

    if (!user) {
      throw userNotFoundError()
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
      select: USER_LIST_SELECT,
    })

    await this.eventEmitter.emitAsync(
      UserStatusChangedEvent.eventType,
      new UserStatusChangedEvent(userId, dto.isActive, user.isActive),
    )

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  }
}
