import type { CompanionMessageFeedback, Prisma } from '@prisma/client'

export interface ICompanionFeedbackRepository {
  create(data: Prisma.CompanionMessageFeedbackCreateInput): Promise<CompanionMessageFeedback>
  findByMessageId(userId: string, messageId: string): Promise<CompanionMessageFeedback | null>
  findRecentByCompanion(
    userId: string,
    companionId: string,
    limit?: number,
  ): Promise<CompanionMessageFeedback[]>
  upsert(
    messageId: string,
    data: {
      userId: string
      companionId: string
      conversationId: string
      rating: 'positive' | 'negative'
      reason?: string
      note?: string
    },
  ): Promise<CompanionMessageFeedback>
  delete(id: string): Promise<CompanionMessageFeedback>
}
