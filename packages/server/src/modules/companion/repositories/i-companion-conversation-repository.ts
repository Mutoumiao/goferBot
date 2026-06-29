import type { CompanionConversation, CompanionMessage, Prisma } from '@prisma/client'
import type { PaginationResult } from '../../../shared/interfaces/paginator.interface.js'

export interface ICompanionConversationRepository {
  create(data: Prisma.CompanionConversationCreateInput): Promise<CompanionConversation>
  findById(id: string): Promise<(CompanionConversation & { messages?: CompanionMessage[] }) | null>
  findByUserAndCompanion(userId: string, companionId: string): Promise<CompanionConversation | null>
  getOrCreate(
    id: string | undefined,
    userId: string,
    companionId: string,
  ): Promise<CompanionConversation>
  findByUserId(
    userId: string,
    options?: { page?: number; size?: number; companionId?: string },
  ): Promise<PaginationResult<CompanionConversation>>
  update(id: string, data: Prisma.CompanionConversationUpdateInput): Promise<CompanionConversation>
  incrementMessageCount(id: string): Promise<CompanionConversation>
  updateSummary(id: string, summaryText: string): Promise<CompanionConversation>
  delete(id: string): Promise<CompanionConversation>
}
