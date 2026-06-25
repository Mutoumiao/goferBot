import { Injectable } from '@nestjs/common'
import type { CompanionConversation, CompanionMessage, Prisma } from '@prisma/client'
import { PrismaService } from '../../../processors/database/prisma.service.js'
import type { PaginationResult } from '../../../shared/interfaces/paginator.interface.js'

@Injectable()
export class CompanionConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.CompanionConversationCreateInput): Promise<CompanionConversation> {
    return this.prisma.companionConversation.create({ data })
  }

  async findById(
    id: string,
  ): Promise<(CompanionConversation & { messages?: CompanionMessage[] }) | null> {
    return this.prisma.companionConversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
  }

  async findByUserAndCompanion(
    userId: string,
    companionId: string,
  ): Promise<CompanionConversation | null> {
    return this.prisma.companionConversation.findUnique({
      where: { userId_companionId: { userId, companionId } },
    })
  }

  async findByUserId(
    userId: string,
    options?: { page?: number; size?: number; companionId?: string },
  ): Promise<PaginationResult<CompanionConversation>> {
    const where: Prisma.CompanionConversationWhereInput = { userId }
    if (options?.companionId) where.companionId = options.companionId

    if (options?.page && options?.size) {
      const result = await this.prisma.companionConversation.paginate(
        { where, orderBy: { updatedAt: 'desc' } },
        { page: options.page, size: options.size },
      )
      return result as unknown as PaginationResult<CompanionConversation>
    }

    const data = await this.prisma.companionConversation.findMany({
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

  async update(
    id: string,
    data: Prisma.CompanionConversationUpdateInput,
  ): Promise<CompanionConversation> {
    return this.prisma.companionConversation.update({ where: { id }, data })
  }

  async incrementMessageCount(id: string): Promise<CompanionConversation> {
    return this.prisma.companionConversation.update({
      where: { id },
      data: {
        messageCount: { increment: 1 },
        lastMessageAtMs: BigInt(Date.now()),
      },
    })
  }

  async delete(id: string): Promise<CompanionConversation> {
    return this.prisma.companionConversation.delete({ where: { id } })
  }
}
