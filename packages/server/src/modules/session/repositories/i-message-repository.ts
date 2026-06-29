import type { Message, Prisma } from '@prisma/client'

export interface IMessageRepository {
  findBySessionId(sessionId: string): Promise<Message[]>
  findUpToMessageId(
    sessionId: string,
    messageId: string,
    options?: { select?: Record<string, boolean> },
  ): Promise<Message[]>
  paginateBySessionId(
    sessionId: string,
    options: { page: number; size: number },
  ): Promise<import('../../../shared/interfaces/paginator.interface.js').PaginationResult<Message>>
  findById(id: string): Promise<Message | null>
  create(data: Prisma.MessageUncheckedCreateInput): Promise<Message>
  update(id: string, data: Prisma.MessageUncheckedUpdateInput): Promise<Message>
  delete(id: string): Promise<Message>
}
