import type { Companion, Prisma } from '@prisma/client'
import type { PaginationResult } from '../../../shared/interfaces/paginator.interface.js'

export interface ICompanionRepository {
  create(data: Prisma.CompanionCreateInput): Promise<Companion>
  findById(id: string): Promise<Companion | null>
  findByUserId(
    userId: string,
    options?: { status?: 'draft' | 'published' | 'archived'; page?: number; size?: number },
  ): Promise<PaginationResult<Companion>>
  update(id: string, data: Prisma.CompanionUpdateInput): Promise<Companion>
  delete(id: string): Promise<Companion>
  exists(id: string): Promise<boolean>
  softDelete(id: string, userId: string): Promise<void>
}
