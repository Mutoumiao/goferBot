import type { KnowledgeBase } from '@prisma/client'
import type { KbCreateData, KbListItem, KbUpdateData } from './kb.repository.js'

export interface IKbRepository {
  findByUserId(userId: string): Promise<KnowledgeBase[]>
  findByIdAndUser(id: string, userId: string): Promise<KnowledgeBase | null>
  findById(id: string): Promise<KnowledgeBase | null>
  findManyByUserIdWithPagination(
    userId: string,
    page: number,
    size: number,
  ): Promise<KnowledgeBase[]>
  countByUserId(userId: string): Promise<number>
  findManyForSelector(userId: string, maxItems: number): Promise<KbListItem[]>
  create(data: KbCreateData): Promise<KnowledgeBase>
  update(id: string, data: KbUpdateData): Promise<KnowledgeBase>
  delete(id: string): Promise<KnowledgeBase>
}
