import { Injectable } from '@nestjs/common'
import type { CompanionMessage, Prisma } from '@prisma/client'
import { PrismaService } from '../../../processors/database/prisma.service.js'

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
    role: string
    content: string
  }): Promise<CompanionMessage> {
    const data = {
      conversationId: input.conversationId,
      role: input.role as 'user' | 'assistant' | 'system',
      content: input.content,
    }
    return this.prisma.companionMessage.create({ data: data as never })
  }

  async findRecent(conversationId: string, limit = 20): Promise<CompanionMessage[]> {
    return this.findByConversation(conversationId, { limit })
  }
}
