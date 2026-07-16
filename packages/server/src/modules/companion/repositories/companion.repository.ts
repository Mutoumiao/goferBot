import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { Companion, Prisma } from '@prisma/client'
import { PrismaService } from '../../../processors/database/prisma.service.js'
import type { PaginationResult } from '../../../shared/interfaces/paginator.interface.js'

export type CompanionAccessAction = 'read' | 'write' | 'chat'

@Injectable()
export class CompanionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.CompanionCreateInput): Promise<Companion> {
    return this.prisma.companion.create({ data })
  }

  async findById(id: string): Promise<Companion | null> {
    return this.prisma.companion.findUnique({ where: { id } })
  }

  /**
   * 鉴权矩阵：
   * - system+published：任意登录用户 read/chat；write 仅 Admin（本仓库方法不用于 Admin 写）
   * - system+!published：Web 用户拒绝
   * - user：仅 owner 的 read/write/chat（draft|published 可 chat；archived 由调用方再拦）
   */
  authorizeCompanionAccess(
    companion: Companion,
    userId: string,
    action: CompanionAccessAction,
  ): void {
    if (companion.source === 'system') {
      if (action === 'write') {
        throw new ForbiddenException('无权修改内置伴侣')
      }
      if (companion.status !== 'published') {
        throw new ForbiddenException('内置伴侣未发布或已归档')
      }
      return
    }

    // source=user
    if (companion.userId !== userId) {
      throw new ForbiddenException('无权访问此伴侣')
    }
    if (action === 'write' || action === 'read' || action === 'chat') {
      return
    }
  }

  async findByIdAndAuthorize(
    id: string,
    userId: string,
    action: CompanionAccessAction = 'read',
  ): Promise<Companion> {
    const companion = await this.findById(id)
    if (!companion) throw new NotFoundException('伴侣不存在')
    this.authorizeCompanionAccess(companion, userId, action)
    return companion
  }

  async findByUserId(
    userId: string,
    options?: { status?: 'draft' | 'published' | 'archived'; page?: number; size?: number },
  ): Promise<PaginationResult<Companion>> {
    const where: Prisma.CompanionWhereInput = {
      userId,
      source: 'user',
    }
    if (options?.status) {
      where.status = options.status
    } else {
      where.status = { not: 'archived' }
    }

    return this.paginate(where, options)
  }

  async findOfficial(
    options?: { page?: number; size?: number },
  ): Promise<PaginationResult<Companion>> {
    return this.paginate(
      { source: 'system', status: 'published' },
      options,
    )
  }

  async findSystemById(id: string): Promise<Companion | null> {
    return this.prisma.companion.findFirst({
      where: { id, source: 'system' },
    })
  }

  async findSystemMany(options?: {
    status?: 'draft' | 'published' | 'archived'
    page?: number
    size?: number
  }): Promise<PaginationResult<Companion>> {
    const where: Prisma.CompanionWhereInput = { source: 'system' }
    if (options?.status) where.status = options.status
    return this.paginate(where, options)
  }

  async countActiveUserCompanions(userId: string): Promise<number> {
    return this.prisma.companion.count({
      where: {
        userId,
        source: 'user',
        status: { in: ['draft', 'published'] },
      },
    })
  }

  private async paginate(
    where: Prisma.CompanionWhereInput,
    options?: { page?: number; size?: number },
  ): Promise<PaginationResult<Companion>> {
    if (options?.page && options?.size) {
      const result = await this.prisma.companion.paginate(
        { where, orderBy: { updatedAt: 'desc' } },
        { page: options.page, size: options.size },
      )
      return result as unknown as PaginationResult<Companion>
    }

    const data = await this.prisma.companion.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })

    return {
      data,
      pagination: {
        total: data.length,
        size: data.length,
        totalPage: 1,
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    }
  }

  async update(id: string, data: Prisma.CompanionUpdateInput): Promise<Companion> {
    return this.prisma.companion.update({ where: { id }, data })
  }

  async delete(id: string): Promise<Companion> {
    return this.prisma.companion.delete({ where: { id } })
  }

  async exists(id: string): Promise<boolean> {
    return this.prisma.companion.exists({ where: { id } })
  }

  async softDelete(id: string, userId: string): Promise<void> {
    await this.findByIdAndAuthorize(id, userId, 'write')
    await this.prisma.companion.update({
      where: { id },
      data: { status: 'archived' },
    })
  }
}
