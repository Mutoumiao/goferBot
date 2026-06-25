import { Injectable } from '@nestjs/common'
import type { CompanionMemory, Prisma } from '@prisma/client'
import { PrismaService } from '../../../processors/database/prisma.service.js'
import type { PaginationResult } from '../../../shared/interfaces/paginator.interface.js'

@Injectable()
export class CompanionMemoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.CompanionMemoryCreateInput): Promise<CompanionMemory> {
    return this.prisma.companionMemory.create({ data })
  }

  async findById(id: string): Promise<CompanionMemory | null> {
    return this.prisma.companionMemory.findUnique({ where: { id } })
  }

  async findActiveByCompanion(
    userId: string,
    companionId: string,
    limit = 12,
  ): Promise<CompanionMemory[]> {
    return this.prisma.companionMemory.findMany({
      where: { userId, companionId, status: 'active' },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    })
  }

  async findByUserId(
    userId: string,
    options?: {
      page?: number
      size?: number
      companionId?: string
      status?: 'active' | 'disabled' | 'deleted'
    },
  ): Promise<PaginationResult<CompanionMemory>> {
    const where: Prisma.CompanionMemoryWhereInput = { userId }
    if (options?.companionId) where.companionId = options.companionId
    if (options?.status) where.status = options.status

    if (options?.page && options?.size) {
      const result = await this.prisma.companionMemory.paginate(
        { where, orderBy: { updatedAt: 'desc' } },
        { page: options.page, size: options.size },
      )
      return result as unknown as PaginationResult<CompanionMemory>
    }

    const data = await this.prisma.companionMemory.findMany({
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

  async update(id: string, data: Prisma.CompanionMemoryUpdateInput): Promise<CompanionMemory> {
    return this.prisma.companionMemory.update({ where: { id }, data })
  }

  async delete(id: string): Promise<CompanionMemory> {
    return this.prisma.companionMemory.delete({ where: { id } })
  }

  async bulkCreate(data: Prisma.CompanionMemoryCreateManyInput[]): Promise<Prisma.BatchPayload> {
    return this.prisma.companionMemory.createMany({
      data,
      skipDuplicates: true,
    })
  }
}
