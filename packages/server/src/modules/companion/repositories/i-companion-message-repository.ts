import type { CompanionMessage, Prisma } from '@prisma/client'
import type { PaginationResult } from '../../../shared/interfaces/paginator.interface.js'

export interface ICompanionMessageRepository {
  create(input: Prisma.CompanionMessageCreateInput): Promise<CompanionMessage>
  createMany(data: Prisma.CompanionMessageCreateManyInput[]): Promise<Prisma.BatchPayload>
  findById(id: string): Promise<CompanionMessage | null>
  findByConversation(
    conversationId: string,
    options?: { limit?: number; beforeId?: string; afterId?: string },
  ): Promise<CompanionMessage[]>
  countByConversation(conversationId: string): Promise<number>
  update(id: string, data: Prisma.CompanionMessageUpdateInput): Promise<CompanionMessage>
  save(input: {
    conversationId: string
    userId?: string
    companionId?: string
    role: string
    content: string
    metadata?: string | null
  }): Promise<CompanionMessage>
  findRecent(conversationId: string, limit?: number): Promise<CompanionMessage[]>
  findByUserAndConversation(
    conversationId: string,
    userId: string,
    options?: { page?: number; size?: number },
  ): Promise<PaginationResult<CompanionMessage>>
}
