import type { CompanionMemory, Prisma } from '@prisma/client'
import type { PaginationResult } from '../../../shared/interfaces/paginator.interface.js'

export interface ICompanionMemoryRepository {
  create(data: Prisma.CompanionMemoryCreateInput): Promise<CompanionMemory>
  findById(id: string): Promise<CompanionMemory | null>
  findActiveByCompanion(
    userId: string,
    companionId: string,
    limit?: number,
  ): Promise<CompanionMemory[]>
  findByUserId(
    userId: string,
    options?: {
      page?: number
      size?: number
      companionId?: string
      status?: 'active' | 'disabled' | 'deleted'
    },
  ): Promise<PaginationResult<CompanionMemory>>
  update(id: string, data: Prisma.CompanionMemoryUpdateInput): Promise<CompanionMemory>
  delete(id: string): Promise<CompanionMemory>
  bulkCreate(data: Prisma.CompanionMemoryCreateManyInput[]): Promise<Prisma.BatchPayload>
}
