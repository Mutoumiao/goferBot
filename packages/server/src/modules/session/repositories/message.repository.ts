import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../processors/database/prisma.service.js'
import { BaseRepository } from '../../../shared/repositories/base.repository.js'
import type { Message, Prisma } from '@prisma/client'

@Injectable()
export class MessageRepository extends BaseRepository<
  Message,
  Prisma.MessageUncheckedCreateInput,
  Prisma.MessageUncheckedUpdateInput
> {
  protected readonly modelName = 'message' as const

  constructor(prisma: PrismaService) {
    super(prisma)
  }

  async findBySessionId(sessionId: string): Promise<Message[]> {
    return this.model.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async findUpToMessageId(
    sessionId: string,
    messageId: string,
    options?: { select?: Record<string, boolean> },
  ): Promise<Message[]> {
    const target = await this.findById(messageId)
    if (!target || target.sessionId !== sessionId) {
      return []
    }
    return this.model.findMany({
      where: {
        sessionId,
        createdAt: { lte: target.createdAt },
      },
      orderBy: { createdAt: 'asc' },
      select: options?.select,
    }) as Promise<Message[]>
  }

  async paginateBySessionId(
    sessionId: string,
    options: { page: number; size: number },
  ) {
    return this.paginate(
      { sessionId },
      { ...options, orderBy: { createdAt: 'asc' } },
    )
  }
}
