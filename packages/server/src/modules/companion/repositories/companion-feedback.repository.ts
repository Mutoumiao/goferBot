import { Injectable } from '@nestjs/common'
import type { CompanionMessageFeedback, Prisma } from '@prisma/client'
import { PrismaService } from '../../../processors/database/prisma.service.js'

@Injectable()
export class CompanionFeedbackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.CompanionMessageFeedbackCreateInput,
  ): Promise<CompanionMessageFeedback> {
    return this.prisma.companionMessageFeedback.create({ data })
  }

  async findByMessageId(
    userId: string,
    messageId: string,
  ): Promise<CompanionMessageFeedback | null> {
    return this.prisma.companionMessageFeedback.findUnique({
      where: { userId_messageId: { userId, messageId } },
    })
  }

  async findRecentByCompanion(
    userId: string,
    companionId: string,
    limit = 8,
  ): Promise<CompanionMessageFeedback[]> {
    return this.prisma.companionMessageFeedback.findMany({
      where: { userId, companionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async findByConversation(
    userId: string,
    conversationId: string,
  ): Promise<CompanionMessageFeedback[]> {
    return this.prisma.companionMessageFeedback.findMany({
      where: { userId, conversationId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async upsert(
    messageId: string,
    data: {
      userId: string
      companionId: string
      conversationId: string
      rating: 'positive' | 'negative'
      reason?: string
      note?: string
    },
  ): Promise<CompanionMessageFeedback> {
    return this.prisma.companionMessageFeedback.upsert({
      where: { userId_messageId: { userId: data.userId, messageId } },
      create: {
        userId: data.userId,
        companionId: data.companionId,
        conversationId: data.conversationId,
        messageId,
        rating: data.rating,
        reason: data.reason,
        note: data.note,
      },
      update: {
        rating: data.rating,
        reason: data.reason,
        note: data.note,
      },
    })
  }

  async delete(id: string): Promise<CompanionMessageFeedback> {
    return this.prisma.companionMessageFeedback.delete({ where: { id } })
  }
}
