import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto.js'
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: AdminUserListQueryDto) {
    const { page, size, search, isActive } = query

    const where: Record<string, unknown> = {}

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
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      { page: page ?? 1, size: size ?? 10 },
    )

    return result
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '用户不存在',
      })
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    })
  }
}
