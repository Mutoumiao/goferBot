import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { CompanionMessage, Prisma } from '@prisma/client'
import { PrismaService } from '../../../processors/database/prisma.service.js'
import type { PaginationResult } from '../../../shared/interfaces/paginator.interface.js'

@Injectable()
export class CompanionMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: Prisma.CompanionMessageCreateInput): Promise<CompanionMessage> {
    return this.prisma.companionMessage.create(input as never)
  }

  async createMany(data: Prisma.CompanionMessageCreateManyInput[]): Promise<Prisma.BatchPayload> {
    return this.prisma.companionMessage.createMany({ data, skipDuplicates: true })
  }

  async findById(id: string): Promise<CompanionMessage | null> {
    return this.prisma.companionMessage.findUnique({ where: { id } })
  }

  async findByConversation(
    conversationId: string,
    options?: { limit?: number; beforeId?: string; afterId?: string },
  ): Promise<CompanionMessage[]> {
    const limit = options?.limit ?? 50
    const take = options?.beforeId ? -limit : limit

    const cursor = options?.afterId
      ? { id: options.afterId }
      : options?.beforeId
        ? { id: options.beforeId }
        : undefined

    if (!cursor) {
      return this.prisma.companionMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: options?.beforeId ? 'desc' : 'asc' },
        take,
      })
    }

    const result = await this.prisma.companionMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: options?.beforeId ? 'desc' : 'asc' },
      cursor,
      skip: 1,
      take,
    })
    return result
  }

  async countByConversation(conversationId: string): Promise<number> {
    return this.prisma.companionMessage.count({ where: { conversationId } })
  }

  async update(id: string, data: Prisma.CompanionMessageUpdateInput): Promise<CompanionMessage> {
    return this.prisma.companionMessage.update({ where: { id }, data })
  }

  async save(input: {
    conversationId: string
    userId?: string
    companionId?: string
    role: string
    content: string
    metadata?: string | null
  }): Promise<CompanionMessage> {
    const data: Record<string, unknown> = {
      conversationId: input.conversationId,
      role: input.role as 'user' | 'assistant' | 'system',
      content: input.content,
    }
    if (input.userId) data.userId = input.userId
    if (input.companionId) data.companionId = input.companionId
    if (input.metadata !== undefined) data.metadata = input.metadata
    return this.prisma.companionMessage.create({ data: data as never })
  }

  /**
   * 取会话**最近** limit 条消息，并按时间正序返回（供 prompt「最近对话」）。
   * 注意：不得用 asc+take（那是「最旧」N 条）。
   */
  async findRecent(conversationId: string, limit = 18): Promise<CompanionMessage[]> {
    const take = Math.max(0, limit)
    if (take === 0) return []

    const rows = await this.prisma.companionMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    })
    // desc 取出最近窗口后反转为正序，便于 formatMessagesForPrompt
    return rows.reverse()
  }

  async findByIdAndAuthorize(
    id: string,
    userId: string,
  ): Promise<
    CompanionMessage & {
      conversation: { userId: string; companionId: string; conversationId?: string }
    }
  > {
    const message = await this.prisma.companionMessage.findUnique({
      where: { id },
      include: { conversation: { select: { userId: true, companionId: true, id: true } } },
    })
    if (!message) throw new NotFoundException('消息不存在')
    if (message.conversation.userId !== userId) throw new ForbiddenException('无权访问此消息')
    return message as CompanionMessage & {
      conversation: { userId: string; companionId: string; conversationId?: string }
    }
  }

  async findByUserAndConversation(
    conversationId: string,
    userId: string,
    options?: { page?: number; size?: number },
  ): Promise<PaginationResult<CompanionMessage>> {
    const where: Prisma.CompanionMessageWhereInput = {
      conversationId,
      conversation: { userId },
    }

    if (options?.page && options?.size) {
      const result = await this.prisma.companionMessage.paginate(
        { where, orderBy: { createdAt: 'asc' } },
        { page: options.page, size: options.size },
      )
      return result as unknown as PaginationResult<CompanionMessage>
    }

    const data = await this.prisma.companionMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
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
}
