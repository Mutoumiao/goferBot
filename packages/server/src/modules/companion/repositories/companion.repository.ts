import { Injectable } from '@nestjs/common'
import type { Companion, Prisma } from '@prisma/client'
import { PrismaService } from '../../../processors/database/prisma.service.js'
import type { PaginationResult } from '../../../shared/interfaces/paginator.interface.js'

@Injectable()
export class CompanionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.CompanionCreateInput): Promise<Companion> {
    return this.prisma.companion.create({ data })
  }

  async findById(id: string): Promise<Companion | null> {
    return this.prisma.companion.findUnique({ where: { id } })
  }

  async findByUserId(
    userId: string,
    options?: { status?: 'draft' | 'published' | 'archived'; page?: number; size?: number },
  ): Promise<PaginationResult<Companion>> {
    const where: Prisma.CompanionWhereInput = { userId }
    if (options?.status) where.status = options.status

    if (options?.page && options?.size) {
      const result = await this.prisma.companion.paginate(
        { where },
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
}
