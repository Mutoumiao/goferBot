import { Injectable } from '@nestjs/common'
import type { KnowledgeBase, Prisma } from '@prisma/client'
import { BaseRepository } from '../../../shared/repositories/base.repository.js'

@Injectable()
export class KbRepository extends BaseRepository<
  KnowledgeBase,
  Prisma.KnowledgeBaseCreateInput,
  Prisma.KnowledgeBaseUpdateInput
> {
  protected readonly modelName = 'knowledgeBase' as const

  async findByUserId(userId: string): Promise<KnowledgeBase[]> {
    return this.model.findMany({ where: { userId } })
  }

  async findByIdAndUser(id: string, userId: string): Promise<KnowledgeBase | null> {
    return this.model.findFirst({ where: { id, userId } })
  }
}
